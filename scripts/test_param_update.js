const assert = require('assert');

function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function simulateUpdate({ nodeText, paramName, value, dataType, isChildConnection }) {
  let openTagEnd = nodeText.length;
  let isSelfClosing = false;
  let inDouble = false;
  let inSingle = false;
  for (let i = 0; i < nodeText.length; i++) {
    const ch = nodeText[i];
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (!inDouble && !inSingle) {
      if (ch === '>') {
        isSelfClosing = i > 0 && nodeText[i - 1] === '/';
        openTagEnd = i + 1;
        break;
      }
    }
  }
  const openTag = nodeText.slice(0, openTagEnd);
  const escapedParam = paramName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  let result = nodeText;

  // 1. Check if the attribute already exists on the opening tag
  const attrRegex = new RegExp(`\\b${escapedParam}\\s*=\\s*("[^"]*"|'[^']*')`);
  const match = openTag.match(attrRegex);

  if (match && match.index !== undefined) {
    if (value === null || value === undefined) {
      // Remove attribute
      const fullAttrRegex = new RegExp(`\\s+\\b${escapedParam}\\s*=\\s*("[^"]*"|'[^']*')`);
      const fullMatch = openTag.match(fullAttrRegex) || match;
      result = nodeText.slice(0, fullMatch.index) + nodeText.slice(fullMatch.index + fullMatch[0].length);
    } else {
      // Targeted replacement of just this one attribute
      const escapedVal = escapeXml(String(value));
      result = nodeText.slice(0, match.index) + `${paramName}="${escapedVal}"` + nodeText.slice(match.index + match[0].length);
    }
  } else {
    // 2. Child element for complex/list
    const childRegex = new RegExp(
      `<([a-zA-Z0-9_-]+:)?${escapedParam}\\b[^>]*>[\\s\\S]*?<\\/([a-zA-Z0-9_-]+:)?${escapedParam}>|<([a-zA-Z0-9_-]+:)?${escapedParam}\\b[^>]*\\/>`
    );
    const childMatch = nodeText.match(childRegex);

    if (childMatch && childMatch.index !== undefined) {
      const prefixMatch = childMatch[0].match(/^<([a-zA-Z0-9_-]+:)/);
      const prefix = prefixMatch ? prefixMatch[1] : '';
      let childContent = '';
      if (dataType === 'list' && Array.isArray(value)) {
        childContent = value.map(v => `<value>${escapeXml(String(v))}</value>`).join('');
      } else {
        childContent = String(value || '');
      }
      const newChildXml = `<${prefix}${paramName}>${childContent}</${prefix}${paramName}>`;
      result = nodeText.slice(0, childMatch.index) + newChildXml + nodeText.slice(childMatch.index + childMatch[0].length);
    } else if ((dataType === 'complex-object' || dataType === 'list') && value !== null && value !== undefined && String(value).trim() !== '') {
      const closingTagMatch = nodeText.match(/<\/([a-zA-Z0-9_-]+:)?([a-zA-Z0-9_-]+)>\s*$/);
      const tagPrefixMatch = openTag.match(/^<([a-zA-Z0-9_-]+:)/);
      const prefix = tagPrefixMatch ? tagPrefixMatch[1] : '';
      let childContent = '';
      if (dataType === 'list' && Array.isArray(value)) {
        childContent = value.map(v => `<value>${escapeXml(String(v))}</value>`).join('');
      } else {
        childContent = String(value || '');
      }

      if (closingTagMatch && closingTagMatch.index !== undefined) {
        const childXml = `\t<${prefix}${paramName}>${childContent}</${prefix}${paramName}>\n\t`;
        result = nodeText.slice(0, closingTagMatch.index) + childXml + nodeText.slice(closingTagMatch.index);
      } else if (isSelfClosing) {
        const tagNameMatch = openTag.match(/^<(([a-zA-Z0-9_-]+:)?[a-zA-Z0-9_-]+)/);
        const fullTagName = tagNameMatch ? tagNameMatch[1] : 'element';
        const childXml = `>\n\t\t<${prefix}${paramName}>${childContent}</${prefix}${paramName}>\n\t</${fullTagName}>`;
        result = nodeText.slice(0, openTagEnd - 2) + childXml + nodeText.slice(openTagEnd);
      }
    } else if (value !== null && value !== undefined && String(value) !== '') {
      const escapedVal = escapeXml(String(value));
      if (isSelfClosing) {
        const beforeSlash = openTag.slice(0, openTagEnd - 2);
        const trailingWsMatch = beforeSlash.match(/\s+$/);
        if (trailingWsMatch && trailingWsMatch.index !== undefined) {
          result = nodeText.slice(0, trailingWsMatch.index) + ` ${paramName}="${escapedVal}"` + nodeText.slice(trailingWsMatch.index);
        } else {
          result = nodeText.slice(0, openTagEnd - 2) + ` ${paramName}="${escapedVal}" ` + nodeText.slice(openTagEnd - 2);
        }
      } else {
        const beforeGt = openTag.slice(0, openTagEnd - 1);
        const trailingWsMatch = beforeGt.match(/\s+$/);
        if (trailingWsMatch && trailingWsMatch.index !== undefined) {
          result = nodeText.slice(0, trailingWsMatch.index) + ` ${paramName}="${escapedVal}"` + nodeText.slice(trailingWsMatch.index);
        } else {
          result = nodeText.slice(0, openTagEnd - 1) + ` ${paramName}="${escapedVal}"` + nodeText.slice(openTagEnd - 1);
        }
      }
    }
  }

  return result;
}

// --- Test 1: Replace attribute on self-closing element
{
  const xml = '<http:request config-ref="HTTP_Config" path="/old-path" method="GET" />';
  const res = simulateUpdate({ nodeText: xml, paramName: 'path', value: '/new-path' });
  assert.strictEqual(res, '<http:request config-ref="HTTP_Config" path="/new-path" method="GET" />');
  console.log('✓ Test 1 passed: Replace attribute on self-closing element');
}

// --- Test 2: Replace attribute with DW expression containing quotes and >
{
  const xml = '<http:request config-ref="HTTP_Config" path="#[\'/old/\' ++ vars.id]" method="GET" />';
  const res = simulateUpdate({ nodeText: xml, paramName: 'path', value: "#['/new/' ++ vars.id]" });
  assert.strictEqual(res, '<http:request config-ref="HTTP_Config" path="#[\'/new/\' ++ vars.id]" method="GET" />');
  console.log('✓ Test 2 passed: Replace attribute with DW expression');
}

// --- Test 3: Insert new attribute on self-closing element
{
  const xml = '<http:request config-ref="HTTP_Config" method="GET" />';
  const res = simulateUpdate({ nodeText: xml, paramName: 'path', value: '/api/v1' });
  assert.strictEqual(res, '<http:request config-ref="HTTP_Config" method="GET" path="/api/v1" />');
  console.log('✓ Test 3 passed: Insert new attribute on self-closing element');
}

// --- Test 4: Insert new attribute on open tag of container element
{
  const xml = '<flow name="myFlow">\n\t<logger message="hi" />\n</flow>';
  const res = simulateUpdate({ nodeText: xml, paramName: 'maxConcurrency', value: '5' });
  assert.strictEqual(res, '<flow name="myFlow" maxConcurrency="5">\n\t<logger message="hi" />\n</flow>');
  console.log('✓ Test 4 passed: Insert new attribute on container open tag');
}

// --- Test 5: Delete attribute
{
  const xml = '<http:request config-ref="HTTP_Config" path="/test" method="GET" />';
  const res = simulateUpdate({ nodeText: xml, paramName: 'path', value: null });
  assert.strictEqual(res, '<http:request config-ref="HTTP_Config" method="GET" />');
  console.log('✓ Test 5 passed: Delete attribute');
}

// --- Test 6: List parameter insert on self-closing
{
  const xml = '<test:operation name="test" />';
  const res = simulateUpdate({ nodeText: xml, paramName: 'items', value: ['alpha', 'beta'], dataType: 'list' });
  assert(res.includes('<test:items><value>alpha</value><value>beta</value></test:items>'));
  assert(res.endsWith('</test:operation>'));
  console.log('✓ Test 6 passed: List parameter expansion on self-closing element');
}

// --- Test 7: List parameter replace existing child
{
  const xml = '<test:operation name="test">\n\t<test:items><value>old</value></test:items>\n</test:operation>';
  const res = simulateUpdate({ nodeText: xml, paramName: 'items', value: ['one', 'two'], dataType: 'list' });
  assert.strictEqual(res, '<test:operation name="test">\n\t<test:items><value>one</value><value>two</value></test:items>\n</test:operation>');
  console.log('✓ Test 7 passed: List parameter replacement on existing child');
}

console.log('\nAll 7 test cases passed successfully!');
