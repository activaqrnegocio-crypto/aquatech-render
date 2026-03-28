import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 465,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

export async function sendWelcomeEmail(to: string, name: string, username: string, password: string) {
  const loginUrl = `${process.env.NEXTAUTH_URL}/admin/login`
  
  const mailOptions = {
    from: `"Aquatech — Innovación Hidráulica" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Bienvenido al Equipo Aquatech',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0B1623; color: #E2E8F0; padding: 40px; border-radius: 12px; max-width: 600px; margin: auto;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #38BDF8; margin: 0; font-size: 28px; letter-spacing: 2px;">A<span>Q</span>UATECH</h1>
          <p style="color: #94A3B8; font-size: 12px; font-style: italic; margin-top: 5px;">innovación hidráulica</p>
        </div>
        
        <div style="background-color: #132238; padding: 30px; border-radius: 16px; border: 1px solid rgba(56, 189, 248, 0.1); box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
          <h2 style="color: #FFFFFF; font-size: 20px; margin-top: 0;">Hola, ${name}</h2>
          <p style="color: #94A3B8; line-height: 1.6;">Es un gusto darte la bienvenida al equipo de <b>Aquatech</b>. Hemos creado tu acceso al sistema CRM para que puedas gestionar y dar seguimiento a nuestros proyectos.</p>
          
          <div style="background-color: #162133; padding: 20px; border-radius: 12px; margin: 25px 0; border: 1px solid rgba(56, 189, 248, 0.2);">
            <h3 style="color: #38BDF8; font-size: 14px; text-transform: uppercase; margin-top: 0; letter-spacing: 1px;">Tus Credenciales de Acceso</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #64748B; padding: 8px 0; font-size: 14px;">Usuario:</td>
                <td style="color: #FFFFFF; padding: 8px 0; font-weight: 600; font-family: monospace; font-size: 16px;">${username}</td>
              </tr>
              <tr>
                <td style="color: #64748B; padding: 8px 0; font-size: 14px;">Contraseña:</td>
                <td style="color: #FFFFFF; padding: 8px 0; font-weight: 600; font-family: monospace; font-size: 16px;">${password}</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin-top: 35px;">
            <a href="${loginUrl}" style="background-color: #38BDF8; color: #0B1623; padding: 14px 30px; border-radius: 10px; text-decoration: none; font-weight: 800; font-size: 15px; display: inline-block; transition: all 0.3s ease;">
              ACCEDER AL CRM
            </a>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #64748B; font-size: 12px;">
          <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
          <p>© ${new Date().getFullYear()} Aquatech. Todos los derechos reservados.</p>
        </div>
      </div>
    `,
  }

  try {
    const info = await transporter.sendMail(mailOptions)
    console.log('Email enviado: %s', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Error enviando email:', error)
    return { success: false, error }
  }
}
