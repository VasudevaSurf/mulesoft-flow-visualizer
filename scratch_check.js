const https = require('https');

const groupId = 'org.mule.connectors';
const artifactId = 'mule-http-connector';
const version = '1.11.1';

const subPaths = ['descriptor', 'operations', 'metadata', 'extension', 'model'];

for (const path of subPaths) {
  const url = `https://anypoint.mulesoft.com/exchange/api/v2/assets/${groupId}/${artifactId}/${version}/${path}`;
  https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
    console.log(`Endpoint /${path} status:`, res.statusCode);
  }).on('error', e => {
    console.log(`Endpoint /${path} error:`, e.message);
  });
}
