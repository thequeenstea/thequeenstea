const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'thequeenstea.ingles@gmail.com',
    pass: 'wijy npdc chse pjsy'
  }
});

function enviarCorreo(destinatario, asunto, html, adjunto = null) {
  const mailOptions = {
    from: '"The Queen’s Tea" <thequeenstea.ingles@gmail.com>',
    to: destinatario,
    subject: asunto,
    html: html,
    attachments: adjunto ? [adjunto] : []
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.error('Error al enviar el correo:', error);
    }
    console.log('✅ Correo enviado:', info.response);
  });
}

module.exports = enviarCorreo;
