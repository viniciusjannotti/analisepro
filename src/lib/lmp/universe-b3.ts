// Lista inicial (120 ações da B3). Lista de partida baseada em liquidez conhecida,
// não em ranking atualizado: a validação de cada ticker e a liquidez real são
// verificadas pelo screener (ticker sem dados aparece em `falhas`).
export const B3_UNIVERSE_INICIAL: string[] = [
  // Financeiro
  'ITUB4', 'BBDC4', 'BBDC3', 'BBAS3', 'SANB11', 'ITSA4', 'B3SA3', 'BPAC11', 'BRSR6', 'PSSA3',
  'BBSE3', 'CXSE3', 'IRBR3', 'ABCB4', 'BMGB4', 'BPAN4', 'CIEL3',
  // Energia e petróleo
  'PETR4', 'PETR3', 'PRIO3', 'RRRP3', 'CSAN3', 'UGPA3', 'VBBR3', 'ENBR3', 'EGIE3', 'CMIG4',
  'TAEE11', 'TRPL4', 'ELET3', 'ELET6', 'EQTL3', 'ENGI11', 'CPLE6', 'SBSP3', 'CPFE3', 'AURE3',
  'SAPR11', 'RAIZ4',
  // Mineração e siderurgia
  'VALE3', 'CSNA3', 'GGBR4', 'USIM5', 'GOAU4', 'CMIN3', 'BRAP4', 'SUZB3', 'KLBN11', 'BRKM5',
  // Consumo e varejo
  'ABEV3', 'MGLU3', 'LREN3', 'PETZ3', 'ASAI3', 'CRFB3', 'PCAR3', 'NTCO3', 'SOMA3', 'ARZZ3',
  'VIVA3', 'ALPA4', 'AZZA3', 'MRFG3', 'BEEF3', 'JBSS3', 'SMTO3', 'BRFS3', 'MDIA3', 'CAML3',
  'GUAR3', 'VIIA3', 'SLCE3', 'ALOS3', 'MOVI3',
  // Construção e imobiliário
  'CURY3', 'DIRR3', 'CYRE3', 'MRVE3', 'EZTC3', 'EVEN3', 'TRIS3',
  // Saúde
  'RDOR3', 'FLRY3', 'HAPV3', 'QUAL3', 'RADL3', 'GNDI3',
  // Industrial, logística e transporte
  'WEGE3', 'RENT3', 'RAIL3', 'CCRO3', 'EMBR3', 'AZUL4', 'GOLL4', 'CVCB3', 'POMO4', 'TUPY3',
  'FRAS3', 'RAPT4', 'LEVE3', 'KEPL3', 'AMBP3', 'MOTV3',
  // Tecnologia, telecom e serviços
  'TOTS3', 'LWSA3', 'CASH3', 'VIVT3', 'TIMS3', 'VULC3', 'STBP3', 'SMFT3', 'SEQL3', 'ENAT3',
  // Educação, lazer e outros
  'YDUQ3', 'COGN3', 'ANIM3', 'VAMO3', 'MULT3', 'SIMH3', 'GMAT3',
]
