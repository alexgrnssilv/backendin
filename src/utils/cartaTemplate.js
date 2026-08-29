import xss from "xss";

/**
 * Constrói o texto da carta de forma corrida a partir dos campos da carta.
 * Aplica também a higienização contra XSS.
 * 
 * @param {Object} carta - Dados da carta vindos do banco de dados
 * @returns {String} - O texto da carta formatado e sanitizado
 */
export function montarTextoCarta(carta) {
  const comoChama = xss(carta.comoChama);
  const mensagemFinal = xss(carta.mensagemFinal);
  const lembranca = xss(carta.lembranca);
  const agradecimento = xss(carta.agradecimento);
  const admiracao = xss(carta.admiracao);
  const nomeRemetente = xss(carta.nomeRemetente);

  return `Querida ${comoChama},

${mensagemFinal}

Sabe, eu sempre me lembro com carinho de quando ${lembranca}.

Hoje, eu quero muito te agradecer por ${agradecimento}.

E se tem algo que eu realmente admiro em você, é ${admiracao}.

Com todo o meu amor,
${nomeRemetente}`;
}
