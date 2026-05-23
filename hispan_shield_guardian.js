/**
 * HISPANSHIELD — GUARDIAN DE PROPIEDAD INTELECTUAL
 * Propiedad de HispanShield (Legion de Ciberdefensa)
 * General Murdok (Gustavo Lobato Clara)
 */
(function() {
  const info = {
    timestamp: new Date().toISOString(),
    platform: typeof navigator !== 'undefined' ? navigator.platform : 'node',
    user: process ? process.env.USER || process.env.USERNAME : 'unknown',
    hostname: require ? require('os').hostname() : 'unknown',
  };
  console.log('=============================================');
  console.log('  HISPANSHIELD — LEGION DE CIBERDEFENSA');
  console.log('  PROPIEDAD DE GENERAL MURDOK (GUSTAVO LOBATO CLARA)');
  console.log('  TODOS LOS DERECHOS RESERVADOS');
  console.log('=============================================');
  console.log('  Auditoria:', info.user + '@' + info.hostname);
  return info;
})();
