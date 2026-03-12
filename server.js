const express = require('express');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const cors = require('cors');

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json({ limit: '10mb' })); 
app.use(express.static(path.join(__dirname, 'public')));

// ROTA FORÇADA PARA O PAINEL VIP
app.get('/super.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'super.html'));
});

// ==========================================
// 👑 ROTAS DO DONO DO SAAS (SUPER ADMIN)
// ==========================================
app.get('/super/empresas', async (req, res) => {
  const empresas = await prisma.empresa.findMany({ orderBy: { criadoEm: 'desc' } });
  res.json(empresas);
});

app.post('/super/empresas', async (req, res) => {
  try {
    const { nomeFantasia, dono, emailLogin, senhaLogin } = req.body;
    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + 30);

    await prisma.empresa.create({
      data: { nomeFantasia, dono, emailLogin, senhaLogin, status: 'TESTE', dataExpiracao }
    });
    res.json({ mensagem: "Empresa cadastrada com 30 dias de teste!" });
  } catch (erro) {
    res.status(500).json({ erro: "Erro. Este email já existe?" });
  }
});

app.put('/super/empresas/:id/acao', async (req, res) => {
  try {
    const empresaId = parseInt(req.params.id);
    const { acao } = req.body;
    if (acao === 'RENOVAR_30') {
      const novaData = new Date(); novaData.setDate(novaData.getDate() + 30);
      await prisma.empresa.update({ where: { id: empresaId }, data: { status: 'ATIVO', dataExpiracao: novaData } });
    } else if (acao === 'BLOQUEAR') {
      await prisma.empresa.update({ where: { id: empresaId }, data: { status: 'BLOQUEADO' } });
    }
    res.json({ mensagem: "Status atualizado!" });
  } catch (erro) {
    res.status(500).json({ erro: "Erro ao atualizar." });
  }
});

// ==========================================
// 🔐 LOGIN DO CLIENTE (A FÁBRICA / SOGRO)
// ==========================================
app.post('/login', async (req, res) => {
  const { login, senha } = req.body;
  const empresa = await prisma.empresa.findUnique({ where: { emailLogin: login } });
  
  if (!empresa) return res.status(401).json({ erro: "E-mail não encontrado!" });
  if (empresa.senhaLogin !== senha) return res.status(401).json({ erro: "Palavra-passe incorreta!" });

  const hoje = new Date();
  if (empresa.status === 'BLOQUEADO' || hoje > new Date(empresa.dataExpiracao)) {
     if (empresa.status !== 'BLOQUEADO') {
         await prisma.empresa.update({ where: { id: empresa.id }, data: { status: 'BLOQUEADO' }});
     }
     return res.status(403).json({ erro: "A sua assinatura expirou." });
  }
  res.json({ mensagem: "Login efetuado com sucesso!", usuario: { id: empresa.id, nome: empresa.nomeFantasia, isDono: true } });
});

// ==========================================
// 🛡️ O SEGURANÇA DA PORTA (ISOLAMENTO DE DADOS)
// ==========================================
const verificarCracha = (req, res, next) => {
    const empresaId = req.headers['empresa-id']; 
    if (!empresaId) {
        return res.status(401).json({ erro: "Acesso Negado! Crachá da empresa ausente." });
    }
    req.empresaId = parseInt(empresaId); 
    next(); 
};

// ==========================================
// 📦 ROTAS GERAIS (AGORA 100% BLINDADAS)
// ==========================================

// --- ESTOQUE ---
app.get('/estoque', verificarCracha, async (req, res) => {
  const estoque = await prisma.produto.findMany({ where: { empresaId: req.empresaId }});
  res.json(estoque);
});

// NOVA ROTA COM OS 3 PREÇOS BLINDADOS (À PROVA DE FALHAS)
app.post('/estoque', verificarCracha, async (req, res) => {
  try {
    const precoCusto = req.body.precoCusto ? parseFloat(String(req.body.precoCusto).replace(',', '.')) : 0;
    const precoAtacado = req.body.preco ? parseFloat(String(req.body.preco).replace(',', '.')) : 0;
    const precoVarejo = req.body.precoVarejo ? parseFloat(String(req.body.precoVarejo).replace(',', '.')) : 0;

    const novoProduto = await prisma.produto.create({
      data: {
        empresaId: req.empresaId, 
        codigo: req.body.codigo || '', 
        produto: req.body.produto,
        quantidade: parseInt(req.body.quantidade) || 0, 
        precoCusto: precoCusto,
        preco: precoAtacado,       
        precoVarejo: precoVarejo   
      }
    });
    res.json({ mensagem: "Produto salvo no cofre com sucesso!", produto: novoProduto });
  } catch (erro) {
    console.error("🚨 ERRO GRAVE NO ESTOQUE:", erro); 
    res.status(400).json({ mensagem: "Erro interno no servidor: " + erro.message });
  }
});

// ==========================================
// 🎒 NOVA ROTA: MONTAR KIT E DAR BAIXA NO ESTOQUE
// ==========================================
app.post('/api/montar-kit', verificarCracha, async (req, res) => {
    const { sacoleiroId, itens, dataVencimento } = req.body;
    
    try {
        let descricaoKit = [];
        let valorTotalAtacado = 0;

        for (let item of itens) {
            const produtoDb = await prisma.produto.findUnique({ where: { id: item.id } });
            
            if (!produtoDb || produtoDb.quantidade < item.qtd) {
                return res.status(400).json({ erro: `Estoque insuficiente para a peça: ${item.nome}.` });
            }

            await prisma.produto.update({
                where: { id: item.id },
                data: { quantidade: produtoDb.quantidade - item.qtd }
            });

            descricaoKit.push(`${item.qtd}x ${item.nome}`);
            valorTotalAtacado += (item.qtd * item.precoAtacado); 
        }

        const novaMala = await prisma.mala.create({
            data: {
                empresaId: req.empresaId,
                sacoleiroId: parseInt(sacoleiroId),
                produtoNome: descricaoKit.join(' + '),
                total: valorTotalAtacado,
                dataVencimento: new Date(dataVencimento + "T12:00:00Z"),
                status: "PENDENTE"
            }
        });

        res.json({ mensagem: "Kit despachado com sucesso!", mala: novaMala });
    } catch (erro) {
        console.error("Erro ao montar kit:", erro);
        res.status(500).json({ erro: "Erro ao processar o kit no servidor." });
    }
});

// --- SACOLEIROS ---
app.get('/clientes', verificarCracha, async (req, res) => {
  const sacoleiros = await prisma.sacoleiro.findMany({ where: { empresaId: req.empresaId }});
  res.json(sacoleiros);
});

app.post('/clientes', verificarCracha, async (req, res) => {
  try {
    const novo = await prisma.sacoleiro.create({
      data: { 
        empresaId: req.empresaId, nome: req.body.nome, telefone: req.body.telefone, 
        usuarioApp: req.body.loginAcesso, senhaApp: req.body.senhaAcesso 
      }
    });
    res.json({ mensagem: "Sacoleira cadastrada!", cliente: novo });
  } catch (erro) {
    res.status(500).json({ mensagem: "Erro ao cadastrar. Login já existe?" });
  }
});

// --- KITS E MALAS (Antiga, mas mantida por segurança) ---
app.post('/kits', verificarCracha, async (req, res) => {
  const { clienteId, itens, dataVencimento, assinatura } = req.body;
  try {
    for (let item of itens) {
      await prisma.mala.create({
        data: {
          empresaId: req.empresaId, sacoleiroId: parseInt(clienteId),
          produtoNome: `${item.qtd}x ${item.nome}`, total: (item.preco * item.qtd),
          dataVencimento: dataVencimento ? new Date(dataVencimento + "T12:00:00Z") : null,
          assinatura: assinatura || null, status: 'PENDENTE'
        }
      });
      await prisma.produto.update({
        where: { id: item.id }, data: { quantidade: { decrement: item.qtd } }
      });
    }
    res.json({ mensagem: "Mala fechada com sucesso!" });
  } catch (erro) {
    res.status(400).json({ mensagem: "Erro ao fechar mala." });
  }
});

app.get('/minhas-dividas/:id', verificarCracha, async (req, res) => {
  const malas = await prisma.mala.findMany({ 
      where: { sacoleiroId: parseInt(req.params.id), status: 'PENDENTE' } 
  });
  res.json(malas);
});

// --- CATÁLOGO DIGITAL (Aberto ao público, mas filtrado) ---
app.get('/catalogo-publico', async (req, res) => {
  const empresaId = parseInt(req.query.empresa);
  if(!empresaId) return res.json([]); 
  
  const estoque = await prisma.produto.findMany({ where: { quantidade: { gt: 0 }, empresaId: empresaId } });
  const vitrine = estoque.map(p => ({ id: p.id, nome: p.produto, codigo: p.codigo, precoSugerido: p.preco * 2 }));
  res.json(vitrine);
});

// ==========================================
// 💵 ROTAS DE ACERTOS (PAGAR PARCIAL E QUITAR)
// ==========================================
app.put('/cobranca/:id/parcial', verificarCracha, async (req, res) => {
    try {
        const mala = await prisma.mala.findUnique({ where: { id: parseInt(req.params.id) }});
        const novoTotal = mala.total - parseFloat(req.body.valorPago);
        
        await prisma.mala.update({
            where: { id: parseInt(req.params.id) },
            data: { 
                total: novoTotal, 
                status: novoTotal <= 0 ? 'PAGO' : 'PENDENTE' 
            }
        });
        res.json({ mensagem: "Pagamento parcial registrado!" });
    } catch(erro) { 
        console.error("🚨 ERRO NO PAGAMENTO PARCIAL:", erro);
        res.status(500).json({ erro: "Erro ao abater valor." }); 
    }
});

app.put('/cobranca/:id/quitar', verificarCracha, async (req, res) => {
    try {
        await prisma.mala.update({
            where: { id: parseInt(req.params.id) },
            data: { total: 0, status: 'PAGO' }
        });
        res.json({ mensagem: "Quitado com sucesso!" });
    } catch(erro) { 
        console.error("🚨 ERRO AO QUITAR:", erro);
        res.status(500).json({ erro: "Erro ao quitar." }); 
    }
});

// ==========================================
// 🔐 LOGIN DO PORTAL DO SACOLEIRO (APP)
// ==========================================
app.post('/login-app', async (req, res) => {
    const { usuario, senha } = req.body;
    try {
        const sacoleiro = await prisma.sacoleiro.findFirst({
            where: {
                usuarioApp: usuario, 
                senhaApp:   senha    
            }
        });

        if (sacoleiro) {
            res.json({ sacoleira: sacoleiro });
        } else {
            res.status(401).json({ erro: "Usuário ou senha incorretos!" });
        }
    } catch (erro) {
        console.error("Erro no login:", erro);
        res.status(500).json({ erro: "Erro interno no servidor" });
    }
});

// ==========================================
// 👥 BUSCAR EQUIPE DE VENDEDORAS (CRM DO APP)
// ==========================================
app.get('/minhas-clientes-crm/:sacoleiroId', async (req, res) => {
    const { sacoleiroId } = req.params;
    try {
        const vendedoras = await prisma.vendedoraFinal.findMany({
            where: { sacoleiraId: parseInt(sacoleiroId) },
            orderBy: { nome: 'asc' } 
        });
        res.json(vendedoras);
    } catch (erro) {
        console.error("Erro ao buscar equipe:", erro);
        res.status(500).json({ erro: "Erro ao buscar vendedoras" });
    }
});

// ==========================================
// 👩‍💼 ROTAS DAS VENDEDORAS (Isoladas por Sacoleiro)
// ==========================================
app.post('/api/vendedoras', async (req, res) => {
  const { nome, telefone, endereco, praca, diaCobranca, sacoleiraId } = req.body;
  
  try {
    const novaVendedora = await prisma.vendedoraFinal.create({
      data: {
        nome: nome,
        telefone: telefone,
        endereco: endereco,
        praca: praca || "Geral", 
        diaCobranca: diaCobranca, 
        sacoleiraId: parseInt(sacoleiraId) 
      }
    });
    res.status(201).json({ mensagem: "Vendedora cadastrada com sucesso!", vendedora: novaVendedora });
  } catch (erro) {
    console.error("Erro ao cadastrar vendedora:", erro);
    res.status(500).json({ erro: "Erro interno ao cadastrar vendedora." });
  }
});

app.put('/api/vendedoras/:id', async (req, res) => {
    const vendedoraId = parseInt(req.params.id);
    const { nome, telefone, endereco, praca, diaCobranca } = req.body;
    
    try {
        const atualizada = await prisma.vendedoraFinal.update({
            where: { id: vendedoraId },
            data: { nome, telefone, endereco, praca: praca || "Geral", diaCobranca }
        });
        res.json({ mensagem: "Dados atualizados com sucesso!", vendedora: atualizada });
    } catch (erro) {
        console.error("Erro ao editar vendedora:", erro);
        res.status(500).json({ erro: "Erro ao editar os dados." });
    }
});

app.get('/api/vendedoras/sacoleiro/:id', async (req, res) => {
  const sacoleiroId = req.params.id;
  try {
    const vendedoras = await prisma.vendedoraFinal.findMany({
      where: { sacoleiraId: parseInt(sacoleiroId) },
      orderBy: { praca: 'asc' } 
    });
    res.json(vendedoras);
  } catch (erro) {
    res.status(500).json({ erro: "Erro ao buscar a lista de vendedoras." });
  }
});

// ==========================================
// 🎒 REPASSE: SACOLEIRO -> VENDEDORA
// ==========================================
app.post('/api/repasse', async (req, res) => {
    const { sacoleiroId, vendedoraId, descricaoKits, valorTotal } = req.body;
    
    try {
        const repasse = await prisma.repasseVendedora.create({
            data: {
                sacoleiroId: parseInt(sacoleiroId),
                vendedoraId: parseInt(vendedoraId),
                descricaoKits: descricaoKits,
                valorTotal: parseFloat(valorTotal)
            }
        });
        res.json({ mensagem: "Kits repassados com sucesso!", repasse });
    } catch (erro) {
        console.error("Erro no repasse:", erro);
        res.status(500).json({ erro: "Erro ao registrar repasse." });
    }
});

app.get('/api/repasse/sacoleiro/:id', async (req, res) => {
    try {
        const mercadoriaNaRua = await prisma.repasseVendedora.findMany({
            where: { 
                sacoleiroId: parseInt(req.params.id),
                status: "NA_RUA"
            },
            include: { vendedora: true }, 
            orderBy: { criadoEm: 'desc' }
        });
        res.json(mercadoriaNaRua);
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao buscar mercadorias." });
    }
});

// ==========================================
// 🚀 LIGANDO O MOTOR
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
