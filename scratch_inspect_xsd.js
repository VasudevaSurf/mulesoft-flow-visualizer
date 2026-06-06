const https = require('https');
const JSZip = require('jszip');
const { XMLParser } = require('fast-xml-parser');

const url = 'https://maven.anypoint.mulesoft.com/api/v3/maven/org/mule/modules/mule-apikit-module/1.11.17/mule-apikit-module-1.11.17-mule-plugin.jar';

function ensureArray(val) {
  if (val === undefined || val === null) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

function getXsdChild(node, localName) {
  if (!node) return undefined;
  for (const key of Object.keys(node)) {
    const local = key.includes(":") ? key.split(":")[1] : key;
    if (local === localName) {
      return node[key];
    }
  }
  return undefined;
}

function shouldSkipElement(name) {
  if (!name) return true;
  const lower = name.toLowerCase();
  return (
    lower.endsWith("-config") ||
    lower.endsWith("-connection") ||
    lower.endsWith("config") ||
    lower.endsWith("connection") ||
    lower.startsWith("abstract-")
  );
}

function findNamedComplexType(name, schema) {
  const list = ensureArray(getXsdChild(schema, "complexType"));
  return list.find((ct) => ct && ct["@_name"] === name);
}

function findNamedSimpleType(name, schema) {
  const list = ensureArray(getXsdChild(schema, "simpleType"));
  return list.find((st) => st && st["@_name"] === name);
}

// named attributeGroup lookup
function findNamedAttributeGroup(name, schema) {
  const list = ensureArray(getXsdChild(schema, "attributeGroup"));
  return list.find((ag) => ag && ag["@_name"] === name);
}

function parseXsdAttribute(attr, schema) {
  if (!attr) return null;
  const name = attr["@_name"];
  if (!name) return null;

  const rawType = attr["@_type"] || "xs:string";
  const type = rawType.includes(":") ? rawType.split(":")[1] : rawType;
  const use = attr["@_use"] || "optional";
  const required = use === "required";
  const defaultValue = attr["@_default"];

  let description;
  const annotation = getXsdChild(attr, "annotation");
  if (annotation) {
    const doc = getXsdChild(ensureArray(annotation)[0], "documentation");
    if (doc) {
      const docVal = ensureArray(doc)[0];
      description = typeof docVal === "string" ? docVal : docVal["#text"] || "";
    }
  }

  let allowedValues;
  const inlineSimpleType = getXsdChild(attr, "simpleType");
  if (inlineSimpleType) {
    const st = ensureArray(inlineSimpleType)[0];
    const restriction = getXsdChild(st, "restriction");
    if (restriction) {
      const enums = getXsdChild(ensureArray(restriction)[0], "enumeration");
      if (enums) {
        allowedValues = ensureArray(enums)
          .map((en) => en && en["@_value"])
          .filter((v) => typeof v === "string");
      }
    }
  } else {
    const localType = rawType.includes(":") ? rawType.split(":")[1] : rawType;
    const st = findNamedSimpleType(localType, schema);
    if (st) {
      const restriction = getXsdChild(st, "restriction");
      if (restriction) {
        const enums = getXsdChild(ensureArray(restriction)[0], "enumeration");
        if (enums) {
          allowedValues = ensureArray(enums)
            .map((en) => en && en["@_value"])
            .filter((v) => typeof v === "string");
        }
      }
    }
  }

  return {
    name,
    type,
    required,
    defaultValue,
    description: description ? description.trim() : undefined,
    allowedValues: allowedValues && allowedValues.length > 0 ? allowedValues : undefined,
  };
}

function gatherAttributesFromComplexType(ct, schema) {
  const params = [];
  if (!ct) return params;

  const directAttrs = ensureArray(getXsdChild(ct, "attribute"));
  for (const attr of directAttrs) {
    const p = parseXsdAttribute(attr, schema);
    if (p) params.push(p);
  }

  const contentKeys = ["complexContent", "simpleContent"];
  for (const cKey of contentKeys) {
    const content = ensureArray(getXsdChild(ct, cKey));
    for (const item of content) {
      const extension = ensureArray(getXsdChild(item, "extension") || getXsdChild(item, "restriction"));
      for (const ext of extension) {
        const extAttrs = ensureArray(getXsdChild(ext, "attribute"));
        for (const attr of extAttrs) {
          const p = parseXsdAttribute(attr, schema);
          if (p) params.push(p);
        }
        const baseType = ext["@_base"];
        if (baseType) {
          const localBaseName = baseType.includes(":") ? baseType.split(":")[1] : baseType;
          const baseCt = findNamedComplexType(localBaseName, schema);
          if (baseCt) {
            params.push(...gatherAttributesFromComplexType(baseCt, schema));
          }
        }
      }
    }
  }

  const attributeGroups = ensureArray(getXsdChild(ct, "attributeGroup"));
  for (const groupRef of attributeGroups) {
    const refName = groupRef["@_ref"];
    if (refName) {
      const localRefName = refName.includes(":") ? refName.split(":")[1] : refName;
      const attrGroup = findNamedAttributeGroup(localRefName, schema);
      if (attrGroup) {
        const groupAttrs = ensureArray(getXsdChild(attrGroup, "attribute"));
        for (const attr of groupAttrs) {
          const p = parseXsdAttribute(attr, schema);
          if (p) params.push(p);
        }
      }
    }
  }

  return params;
}

function parseXsd(content) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) => {
      const local = name.includes(":") ? name.split(":")[1] : name;
      return [
        "element", "attribute", "enumeration",
        "complexType", "extension", "sequence",
        "choice", "group", "attributeGroup", "simpleType", "restriction"
      ].includes(local);
    }
  });

  let parsed;
  try {
    parsed = parser.parse(content);
  } catch (err) {
    console.warn(`[MuleViz] Failed to parse:`, err);
    return [];
  }

  let schema;
  for (const key of Object.keys(parsed)) {
    const local = key.includes(":") ? key.split(":")[1] : key;
    if (local === "schema") {
      schema = parsed[key];
      break;
    }
  }
  if (!schema) return [];

  const elements = ensureArray(getXsdChild(schema, "element"));
  const ops = [];

  for (const el of elements) {
    if (!el || typeof el !== "object") continue;
    const name = el["@_name"];
    if (!name || shouldSkipElement(name)) continue;

    let parameters = [];

    const inlineComplexType = getXsdChild(el, "complexType");
    if (inlineComplexType) {
      parameters = gatherAttributesFromComplexType(ensureArray(inlineComplexType)[0], schema);
    } else {
      const typeRef = el["@_type"];
      if (typeRef) {
        const localTypeName = typeRef.includes(":") ? typeRef.split(":")[1] : typeRef;
        const ct = findNamedComplexType(localTypeName, schema);
        if (ct) {
          parameters = gatherAttributesFromComplexType(ct, schema);
        }
      }
    }

    let description;
    const annotation = getXsdChild(el, "annotation");
    if (annotation) {
      const doc = getXsdChild(ensureArray(annotation)[0], "documentation");
      if (doc) {
        const docVal = ensureArray(doc)[0];
        description = typeof docVal === "string" ? docVal : docVal["#text"] || "";
      }
    }

    ops.push({
      name,
      description: description ? description.trim() : undefined,
      parameters
    });
  }

  return ops;
}

https.get(url, (res) => {
  const chunks = [];
  res.on('data', chunk => chunks.push(chunk));
  res.on('end', async () => {
    const buffer = Buffer.concat(chunks);
    const zip = await JSZip.loadAsync(buffer);
    const file = zip.files['META-INF/mule-apikit.xsd'];
    const xsdContent = await file.async('string');
    const ops = parseXsd(xsdContent);
    console.log('Extracted operations count:', ops.length);
    if (ops.length > 0) {
      console.log('Operations:', ops.map(o => ({ name: o.name, params: o.parameters.length })));
      console.log('Sample Operation attributes (router):', ops.find(o => o.name === 'router')?.parameters);
    }
  });
});
