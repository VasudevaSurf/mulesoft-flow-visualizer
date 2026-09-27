#!/usr/bin/env node
/**
 * Standalone test runner for ExtensionModelReader.
 * Usage: node scripts/test-extension-model.js <path-to-jar> [operation-id]
 */
const path = require('path');
const fs = require('fs');

// Ensure compiled files exist
const readerPath = path.join(__dirname, '..', 'out', 'catalog', 'extensionModelReader.js');
if (!fs.existsSync(readerPath)) {
  console.error('Please run "npm run compile" first. Could not find:', readerPath);
  process.exit(1);
}

const { ExtensionModelReader } = require(readerPath);

async function main() {
  const jarPath = process.argv[2];
  const requestedOpId = process.argv[3];

  if (!jarPath) {
    console.error('Usage: node scripts/test-extension-model.js <path-to-mule-plugin-jar> [operation-id]');
    process.exit(1);
  }

  if (!fs.existsSync(jarPath)) {
    console.error('JAR file not found at:', jarPath);
    process.exit(1);
  }

  console.log('Reading Extension Model from:', jarPath);
  const startTime = Date.now();
  const model = await ExtensionModelReader.readFromJar(jarPath);
  const elapsed = Date.now() - startTime;

  if (!model) {
    console.log('No extension model could be parsed from this JAR (neither JSON nor XSD found in META-INF/).');
    return;
  }

  console.log(`\nSuccessfully extracted Extension Model in ${elapsed}ms:`);
  console.log('\n--- Extension Model Summary ---');
  console.log(`Name:            ${model.name}`);
  console.log(`Source Type:     ${model.sourceType.toUpperCase()} (${model.sourceFile})`);
  console.log(`Namespace URI:   ${model.namespaceUri || 'N/A'}`);
  console.log(`Configurations:  ${model.configurations.length}`);
  for (const c of model.configurations) {
    const cpCount = c.connectionProviders ? c.connectionProviders.length : (c.connectionProvider ? 1 : 0);
    console.log(`  - Config "${c.id || c.name}" ("${c.displayName}"): ${c.groups.length} group(s), ${c.parameters ? c.parameters.length : 0} params, ${cpCount} connection provider(s)`);
  }
  console.log(`Operations:      ${model.operations.length}`);
  for (const op of model.operations) {
    const groupNames = op.groups.map(g => `${g.name} (${g.parameters.length})`).join(', ');
    console.log(`  - Op "${op.id || op.name}" ("${op.displayName}"): [${groupNames}]`);
  }
  console.log(`Sources:         ${model.sources.length}`);
  for (const s of model.sources) {
    const groupNames = s.groups.map(g => `${g.name} (${g.parameters.length})`).join(', ');
    console.log(`  - Source "${s.id || s.name}" ("${s.displayName}"): [${groupNames}]`);
  }

  // Pick operation to log
  let targetOp = null;
  if (requestedOpId) {
    targetOp = model.operations.find(o => (o.id || o.name).toLowerCase() === requestedOpId.toLowerCase());
  }
  if (!targetOp) {
    // Default to 'select' if present (DB connector) or 'request' (HTTP connector)
    targetOp = model.operations.find(o => (o.id || o.name) === 'select') ||
               model.operations.find(o => (o.id || o.name) === 'request') ||
               model.operations[0];
  }

  if (targetOp) {
    console.log('\n' + '='.repeat(80));
    console.log(`Operation "${targetOp.displayName}" (id: "${targetOp.id || targetOp.name}") - Detailed Breakdown`);
    console.log('='.repeat(80));
    console.log(`Icon ID: ${targetOp.iconId}`);
    console.log(`Total Groups: ${targetOp.groups.length}`);

    for (const group of targetOp.groups) {
      console.log('\n' + '-'.repeat(80));
      console.log(`Tab / Group: [ ${group.name} ] (${group.parameters.length} parameter${group.parameters.length === 1 ? '' : 's'})`);
      console.log('-'.repeat(80));
      console.log(JSON.stringify(group.parameters, null, 2));
    }

    // Validation checks
    console.log('\n' + '='.repeat(80));
    console.log('Parameter Field Completeness & Grouping Validation:');
    console.log('='.repeat(80));

    const requiredFields = [
      'name',
      'label',
      'description',
      'dataType',
      'required',
      'defaultValue',
      'group',
      'supportsExpression',
      'isReference'
    ];

    const allParams = targetOp.parameters || targetOp.groups.flatMap(g => g.parameters);
    let allValid = true;

    for (const param of allParams) {
      for (const field of requiredFields) {
        if (!(field in param)) {
          console.error(`FAIL: Parameter "${param.name}" missing field "${field}"`);
          allValid = false;
        }
      }
      if (param.isReference && !param.referenceType) {
        console.error(`FAIL: Parameter "${param.name}" has isReference=true but missing referenceType`);
        allValid = false;
      }
      if (param.dataType === 'enum' && (!param.allowedValues || param.allowedValues.length === 0)) {
        console.warn(`WARN: Parameter "${param.name}" has dataType='enum' without allowedValues`);
      }
    }

    if (allValid) {
      console.log(`[PASS] All ${allParams.length} parameters contain all required fields.`);
    }

    const groupsFound = targetOp.groups.map(g => g.name);
    console.log(`[PASS] Groups detected: ${groupsFound.join(', ')}`);
    const hasGeneral = groupsFound.includes('General');
    const hasAdvanced = groupsFound.includes('Advanced');
    if (hasGeneral && hasAdvanced) {
      console.log(`[PASS] Operation successfully separated into two distinct groups: "General" and "Advanced".`);
    } else {
      console.log(`[INFO] Group distribution: ${groupsFound.join(', ')}`);
    }
  }
}

main().catch(err => {
  console.error('Error running test script:', err);
  process.exit(1);
});
