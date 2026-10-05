// Universo ativo do screener: ações da B3 com cobertura de histórico na fonte (Yahoo).
// Lista de partida baseada em liquidez conhecida, não em ranking atualizado.
export const B3_UNIVERSE_INICIAL: string[] = [
  // Financeiro
  'ITUB4', 'BBDC4', 'BBDC3', 'BBAS3', 'SANB11', 'ITSA4', 'B3SA3', 'BPAC11', 'BRSR6', 'PSSA3',
  'BBSE3', 'CXSE3', 'IRBR3', 'ABCB4', 'BMGB4',
  // Energia e petróleo
  'PETR4', 'PETR3', 'PRIO3', 'CSAN3', 'UGPA3', 'VBBR3', 'EGIE3', 'CMIG4',
  'TAEE11', 'EQTL3', 'ENGI11', 'SBSP3', 'CPFE3', 'AURE3', 'SAPR11', 'RAIZ4',
  // Mineração e siderurgia
  'VALE3', 'CSNA3', 'GGBR4', 'USIM5', 'GOAU4', 'CMIN3', 'BRAP4', 'SUZB3', 'KLBN11', 'BRKM5',
  // Consumo e varejo
  'ABEV3', 'MGLU3', 'LREN3', 'ASAI3', 'PCAR3', 'SMTO3', 'VIVA3', 'ALPA4', 'AZZA3', 'BEEF3',
  'MDIA3', 'CAML3', 'SLCE3', 'ALOS3', 'MOVI3',
  // Construção e imobiliário
  'CURY3', 'DIRR3', 'CYRE3', 'MRVE3', 'EZTC3', 'EVEN3', 'TRIS3',
  // Saúde
  'RDOR3', 'FLRY3', 'HAPV3', 'QUAL3', 'RADL3',
  // Industrial, logística e transporte
  'WEGE3', 'RENT3', 'RAIL3', 'CVCB3', 'POMO4', 'TUPY3', 'FRAS3', 'RAPT4', 'LEVE3', 'KEPL3', 'MOTV3', 'AMBP3',
  // Tecnologia, telecom e serviços
  'TOTS3', 'LWSA3', 'CASH3', 'VIVT3', 'TIMS3', 'VULC3', 'SMFT3', 'SEQL3',
  // Educação, lazer e outros
  'YDUQ3', 'COGN3', 'ANIM3', 'VAMO3', 'MULT3', 'SIMH3', 'GMAT3',
]

// Fora do universo ativo até revisão: sem histórico na fonte (ver relatório de alinhamento).
export const B3_SEM_DADOS_FONTE: string[] = [
  'BPAN4', 'CIEL3', 'RRRP3', 'ENBR3', 'TRPL4', 'ELET3', 'ELET6', 'CPLE6', 'CRFB3', 'PETZ3',
  'NTCO3', 'ARZZ3', 'SOMA3', 'MRFG3', 'JBSS3', 'BRFS3', 'VIIA3', 'GUAR3', 'GNDI3', 'CCRO3',
  'EMBR3', 'GOLL4', 'AZUL4', 'STBP3', 'ENAT3',
]
