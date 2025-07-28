const enviarCorreo = require('./correo');

const miEmailDePrueba = 'cynthiaylenferreyra@gmail.com';  // Poné un correo donde quieras recibir el email

enviarCorreo(miEmailDePrueba, 'Prueba de envío', '<h1>¡Funciona el correo automático!</h1><p>Este es un mensaje de prueba.</p>');
