import { Resend } from 'resend'

const resendApiKey = process.env.RESEND_API_KEY || 're_dummy_fallback_for_build'
const emailRemetente = process.env.EMAIL_FROM || 'Fixum <seguranca@fixum.com.br>'

export const resend = new Resend(resendApiKey)

interface EnviarOtpProps {
  email: string
  codigo: string
  motivo?: string
  nome?: string
}

/**
 * Dispara e-mail com Código de Segurança OTP (6 dígitos) da Fixum
 */
export async function enviarCodigoOtpEmail({ email, codigo, motivo, nome }: EnviarOtpProps) {
  try {
    let tituloMotivo = 'Código de Verificação de Segurança'
    let explicacao = 'Você solicitou uma ação de segurança na plataforma Fixum.'

    if (motivo === 'criar_operador') {
      tituloMotivo = 'Ativação de Conta de Operador Administrativo'
      explicacao = 'Uma conta de operador interno no Backoffice da Fixum foi solicitada para o seu e-mail. Utilize o código de 6 dígitos abaixo para validar seu acesso.'
    } else if (motivo === 'cadastro') {
      tituloMotivo = 'Ativação da sua Conta na Fixum'
      explicacao = 'Para concluir seu cadastro e ativar com segurança sua conta na plataforma Fixum, utilize o código de 6 dígitos abaixo.'
    } else if (motivo === 'login_admin') {
      tituloMotivo = 'Código de Acesso ao Painel Master'
      explicacao = 'Identificamos uma tentativa de login no Painel Executivo da Fixum. Digite o código de 6 dígitos para autorizar a entrada.'
    } else if (motivo === 'ativar_2fa') {
      tituloMotivo = 'Ativação da Verificação em 2 Etapas'
      explicacao = 'Para ativar a proteção 2FA na sua conta Fixum, confirme o código numérico abaixo.'
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${tituloMotivo}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0F1714; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #FAF7F1;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0F1714; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="560" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #16201C; border-radius: 16px; border: 1px solid #22302A; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);">
          
          <!-- Topo Branded -->
          <tr>
            <td style="background: linear-gradient(135deg, #22302A, #16201C); padding: 28px 32px; border-bottom: 1px solid #22302A; text-align: center;">
              <h1 style="margin: 0; color: #F3EEE4; font-size: 28px; font-weight: 800; letter-spacing: -0.03em; font-family: Arial, Helvetica, sans-serif;">
                fi<span style="color: #D4401F;">x</span>um
              </h1>
              <p style="margin: 6px 0 0 0; color: #A39A8A; font-size: 13px;">
                Explore onde você quer viver.
              </p>
            </td>
          </tr>

          <!-- Corpo da Mensagem -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <h2 style="margin: 0 0 12px 0; color: #F0A58F; font-size: 18px; font-weight: 700;">
                ${tituloMotivo}
              </h2>
              
              <p style="margin: 0 0 16px 0; color: #CFC6B6; font-size: 14px; line-height: 1.6;">
                Olá${nome ? ` <strong>${nome}</strong>` : ''},
              </p>
              
              <p style="margin: 0 0 24px 0; color: #A39A8A; font-size: 14px; line-height: 1.6;">
                ${explicacao}
              </p>

              <!-- Caixa do Código OTP -->
              <div style="background-color: #22302A; border: 2px dashed #2C5F8A; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <span style="display: block; color: #A39A8A; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; font-weight: 600;">
                  Seu Código de Confirmação
                </span>
                <span style="display: inline-block; color: #F0A58F; font-size: 36px; font-weight: 900; letter-spacing: 10px; font-family: monospace;">
                  ${codigo}
                </span>
              </div>

              <!-- Aviso de Validade e Segurança -->
              <div style="background: rgba(227, 167, 47, 0.1); border-left: 3px solid #E3A72F; padding: 12px 16px; border-radius: 6px; margin-bottom: 24px;">
                <p style="margin: 0; color: #E8B84A; font-size: 12.5px; line-height: 1.5;">
                  <strong>Validade:</strong> Este código expira em <strong>10 minutos</strong>.<br>
                  <strong>Segurança:</strong> Nunca compartilhe este código com ninguém. A equipe Fixum nunca solicitará seus códigos por telefone ou mensagem.
                </p>
              </div>

              <p style="margin: 0; color: #7A7264; font-size: 12.5px; line-height: 1.5;">
                Se você não solicitou este código, nenhuma ação é necessária. Sua conta permanece segura.
              </p>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="background-color: #0F1714; padding: 20px 32px; border-top: 1px solid #22302A; text-align: center;">
              <p style="margin: 0 0 6px 0; color: #7A7264; font-size: 12px;">
                © ${new Date().getFullYear()} Fixum Tecnologia Imobiliária Ltda. Todos os direitos reservados.
              </p>
              <p style="margin: 0; color: #5A5449; font-size: 11px;">
                Enviado com segurança via Fixum Cloud Security
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

    const { data, error } = await resend.emails.send({
      from: emailRemetente,
      to: [email],
      subject: `[Fixum] Seu código de verificação: ${codigo}`,
      html: htmlContent,
    })

    if (error) {
      console.error('Erro Resend:', error)
      return { sucesso: false, error: error.message }
    }

    return { sucesso: true, id: data?.id }
  } catch (err: any) {
    console.error('Falha geral ao disparar e-mail:', err)
    return { sucesso: false, error: err?.message || 'Falha no envio de e-mail' }
  }
}

/**
 * Dispara e-mail de alerta de novo lead para o Corretor / Imobiliária
 */
export async function enviarAlertaLeadEmail({
  emailCorretor,
  nomeCorretor,
  nomeLead,
  telefoneLead,
  emailLead,
  mensagem,
  tituloImovel,
  codigoImovel,
}: {
  emailCorretor: string
  nomeCorretor?: string
  nomeLead: string
  telefoneLead?: string
  emailLead?: string
  mensagem?: string
  tituloImovel: string
  codigoImovel?: string
}) {
  try {
    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; background-color: #0F1714; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #FAF7F1;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="560" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #16201C; border-radius: 16px; border: 1px solid #22302A; overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #0F1714, #16201C); padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: #F0A58F; font-size: 20px; font-weight: 800;">Novo contato recebido na Fixum</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px;">
              <p style="margin: 0 0 12px; color: #CFC6B6; font-size: 14px;">Olá <strong>${nomeCorretor || 'Corretor'}</strong>,</p>
              <p style="color: #A39A8A; font-size: 14px; margin-bottom: 20px;">Um interessado entrou em contato referente ao seu imóvel anunciado:</p>
              
              <div style="background: #22302A; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
                <strong style="color: #ffffff; font-size: 15px;">${tituloImovel}</strong>
                ${codigoImovel ? `<div style="color: #F0A58F; font-size: 12px; margin-top: 4px;">Código: ${codigoImovel}</div>` : ''}
              </div>

              <div style="background: #16201C; border: 1px solid #3F3B34; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0 0 6px 0; color: #CFC6B6; font-size: 13.5px;"><strong>Nome:</strong> ${nomeLead}</p>
                ${telefoneLead ? `<p style="margin: 0 0 6px 0; color: #CFC6B6; font-size: 13.5px;"><strong>WhatsApp:</strong> <a href="https://wa.me/55${telefoneLead.replace(/\D/g, '')}" style="color: #F0A58F;">${telefoneLead}</a></p>` : ''}
                ${emailLead ? `<p style="margin: 0 0 6px 0; color: #CFC6B6; font-size: 13.5px;"><strong>E-mail:</strong> ${emailLead}</p>` : ''}
                ${mensagem ? `<p style="margin: 10px 0 0 0; color: #A39A8A; font-size: 13px; font-style: italic;">"${mensagem}"</p>` : ''}
              </div>

              <div style="text-align: center;">
                <a href="https://fixum.com.br/painel" style="display: inline-block; background: #16201C; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
                  Abrir painel de contatos →
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

    const { data, error } = await resend.emails.send({
      from: emailRemetente,
      to: [emailCorretor],
      subject: `[Novo Lead] ${nomeLead} tem interesse em seu imóvel`,
      html: htmlContent,
    })

    if (error) return { sucesso: false, error: error.message }
    return { sucesso: true, id: data?.id }
  } catch (err: any) {
    return { sucesso: false, error: err?.message }
  }
}
