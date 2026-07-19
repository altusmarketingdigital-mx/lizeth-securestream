const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.EMAIL_FROM || 'Lizeth The Barberette <no-reply@lizeththebarberette.com>';
const SUPPORT_EMAIL = process.env.EMAIL_SUPPORT || 'soporte@lizeththebarberette.com';

const sendEmail = async ({ to, subject, html }) => {
    if (!resend) {
        console.log('\n==================================================');
        console.log(`📧 SIMULACIÓN DE CORREO PARA: ${to}`);
        console.log(`Asunto: ${subject}`);
        console.log(`Contenido HTML:\n${html}`);
        console.log('==================================================\n');
        return true;
    }

    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to,
            subject,
            html
        });
        if (error) {
            console.error('Error enviando correo con Resend:', error);
            return false;
        }
        return true;
    } catch (err) {
        console.error('Excepción enviando correo:', err);
        return false;
    }
};

const getBaseTemplate = (content) => `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #111; color: #fff; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #1a1a1a; padding: 40px; border-top: 5px solid #9a22ab; }
        .logo { text-align: center; margin-bottom: 30px; }
        .logo img { height: 60px; }
        .content { font-size: 16px; line-height: 1.6; color: #ddd; }
        .btn { display: inline-block; padding: 14px 28px; background-color: #9a22ab; color: #fff; text-decoration: none; border-radius: 30px; font-weight: bold; margin-top: 20px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #333; text-align: center; font-size: 12px; color: #777; }
        h1, h2, h3 { color: #fff; font-weight: normal; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <!-- Asumiendo que hospedarás el logo en algún lado, aquí va un placeholder, puedes cambiar la URL luego -->
            <h2 style="color: #9a22ab; font-weight: bold; letter-spacing: 2px;">LIZETH THE BARBERETTE</h2>
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Lizeth The Barberette. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>
`;

exports.sendWelcomeEmail = async (email, name) => {
    const html = getBaseTemplate(`
        <h2>¡Bienvenido/a al club, ${name}!</h2>
        <p>Gracias por unirte a Lizeth The Barberette. Aquí tendrás acceso exclusivo a las mejores masterclasses de barbería y contenido premium.</p>
        <p>Prepárate para llevar tus habilidades al siguiente nivel.</p>
        <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/catalog.html" class="btn">Explorar Cursos</a>
        </div>
    `);
    return sendEmail({ to: email, subject: '¡Bienvenido a Lizeth The Barberette!', html });
};

exports.sendMagicLink = async (email, resetUrl) => {
    const html = getBaseTemplate(`
        <h2>Recuperación de Contraseña</h2>
        <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.</p>
        <p>Haz clic en el siguiente botón para crear una nueva contraseña. Este enlace expira en 1 hora.</p>
        <div style="text-align: center;">
            <a href="${resetUrl}" class="btn">Restablecer Contraseña</a>
        </div>
        <p style="margin-top: 30px; font-size: 14px;">Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
    `);
    return sendEmail({ to: email, subject: 'Restablece tu contraseña - Lizeth The Barberette', html });
};

exports.sendPurchaseReceipt = async (email, title, amount, currency, videoUrl) => {
    const html = getBaseTemplate(`
        <h2>¡Gracias por tu compra!</h2>
        <p>Tu pago se ha procesado exitosamente y tu curso ya está disponible en tu biblioteca.</p>
        <div style="background: #222; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="margin-top:0; color:#9a22ab;">Resumen de Compra</h3>
            <p><strong>Curso:</strong> ${title}</p>
            <p><strong>Total pagado:</strong> $${amount} ${currency}</p>
        </div>
        <p>Puedes acceder al curso inmediatamente:</p>
        <div style="text-align: center;">
            <a href="${videoUrl}" class="btn">Ver Curso Ahora</a>
        </div>
    `);
    return sendEmail({ to: email, subject: `Recibo de Compra: ${title}`, html });
};

exports.sendContactMessage = async (name, userEmail, reason, message) => {
    const html = getBaseTemplate(`
        <h2>Nuevo Mensaje de Soporte</h2>
        <div style="background: #222; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <p><strong>De:</strong> ${name} (${userEmail})</p>
            <p><strong>Motivo:</strong> ${reason}</p>
            <hr style="border-color:#333; margin: 15px 0;">
            <p style="white-space: pre-wrap;">${message}</p>
        </div>
    `);
    return sendEmail({ to: SUPPORT_EMAIL, subject: `Soporte: ${reason} - ${name}`, html });
};

exports.sendNewPassword = async (email, name, newPassword) => {
    const displayName = name || 'Usuario';
    const loginUrl = (process.env.FRONTEND_URL || 'https://www.lizethbarberette.com') + '/login.html';
    const html = getBaseTemplate(`
        <h2>Tu contrasena fue restablecida</h2>
        <p>Hola ${displayName},</p>
        <p>El administrador de <strong>Lizeth The Barberette</strong> genero una nueva contrasena temporal para tu cuenta.</p>
        <div style="background: #222; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
            <p style="font-size: 13px; color: #aaa; margin-bottom: 8px;">Tu nueva contrasena:</p>
            <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; margin: 0; color: #9a22ab; font-family: monospace;">${newPassword}</p>
        </div>
        <p>Inicia sesion con esta contrasena y cambiarla desde la seccion <strong>Seguridad</strong> de tu panel.</p>
        <div style="text-align: center; margin-top: 30px;">
            <a href="${loginUrl}" class="btn">Iniciar Sesion</a>
        </div>
    `);
    return sendEmail({ to: email, subject: 'Tu nueva contrasena - Lizeth The Barberette', html });
};