import fs from 'node:fs'; import tls from 'node:tls';
fs.mkdirSync('/home/node/.local/etc', { recursive: true });
fs.writeFileSync('/home/node/.local/etc/ca.pem', tls.rootCertificates.join('\n'));
console.log('ca bundle', tls.rootCertificates.length);
