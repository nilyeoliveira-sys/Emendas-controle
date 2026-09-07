const api = async (url, options = {}) => {
  const res = await fetch(`/api${url}`, {
    method: options.method || 'GET',
    headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.erro || 'Erro inesperado.');
  return data;
};

const app = document.getElementById('app');
const state = { usuario: null, fases: [], rota: 'carregando' };

function podeEditar() {
  return state.usuario && ['administrador', 'editor'].includes(state.usuario.papel);
}
function ehAdmin() {
  return state.usuario && state.usuario.papel === 'administrador';
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatarData(iso) {
  if (!iso) return '';
  return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString('pt-BR');
}

async function carregarSessao() {
  try {
    const { usuario } = await api('/auth/me');
    state.usuario = usuario;
    const { fases } = await api('/fases');
    state.fases = fases;
    navegar('lista');
  } catch {
    state.usuario = null;
    navegar('login');
  }
}

function navegar(rota, params = {}) {
  state.rota = rota;
  state.params = params;
  render();
}

function topbar(tituloExtra) {
  if (!state.usuario) return '';
  return `
    <header class="topbar">
      <h1>Emendas &amp; Convênios ${tituloExtra ? `· ${tituloExtra}` : ''}</h1>
      <nav>
        <button class="btn secondary" data-rota="lista">Processos</button>
        <button class="btn secondary" data-rota="contas">Contas a pagar</button>
        ${ehAdmin() ? '<button class="btn secondary" data-rota="config">Configurações</button>' : ''}
        <button class="btn danger" id="btn-sair">Sair</button>
      </nav>
    </header>`;
}

async function render() {
  app.innerHTML = '';
  const rotas = {
    carregando: telaCarregando,
    login: telaLogin,
    registro: telaRegistro,
    lista: telaLista,
    detalhe: telaDetalhe,
    config: telaConfig,
    contas: telaContas,
  };
  await (rotas[state.rota] || telaLista)();
  ligarNavegacaoComum();
}

function ligarNavegacaoComum() {
  app.querySelectorAll('[data-rota]').forEach((el) => {
    el.addEventListener('click', () => navegar(el.dataset.rota, {}));
  });
  const sair = document.getElementById('btn-sair');
  if (sair) sair.addEventListener('click', async () => {
    await api('/auth/logout', { method: 'POST' });
    state.usuario = null;
    navegar('login');
  });
}

function telaCarregando() {
  app.innerHTML = `<div class="login-wrap"><p class="aviso">Carregando…</p></div>`;
}

function telaLogin() {
  app.innerHTML = `
    <div class="login-wrap">
      <div class="card login-card">
        <h1>Emendas &amp; Convênios</h1>
        <div id="erro" class="erro"></div>
        <form id="form-login">
          <label>E-mail</label>
          <input type="email" name="email" required />
          <label>Senha</label>
          <input type="password" name="senha" required />
          <button class="btn" style="width:100%" type="submit">Entrar</button>
        </form>
        <p class="link-alt">Não tem conta? <a data-rota="registro">Cadastre-se</a></p>
      </div>
    </div>`;
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(e.target));
    try {
      const { usuario } = await api('/auth/login', { method: 'POST', body: dados });
      state.usuario = usuario;
      const { fases } = await api('/fases');
      state.fases = fases;
      navegar('lista');
    } catch (err) {
      document.getElementById('erro').textContent = err.message;
    }
  });
}

function telaRegistro() {
  app.innerHTML = `
    <div class="login-wrap">
      <div class="card login-card">
        <h1>Criar conta</h1>
        <div id="erro" class="erro"></div>
        <form id="form-registro">
          <label>Nome</label>
          <input name="nome" required />
          <label>E-mail</label>
          <input type="email" name="email" required />
          <label>Senha</label>
          <input type="password" name="senha" minlength="6" required />
          <button class="btn" style="width:100%" type="submit">Cadastrar</button>
        </form>
        <p class="link-alt"><a data-rota="login">Voltar ao login</a></p>
      </div>
    </div>`;
  document.getElementById('form-registro').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(e.target));
    try {
      await api('/auth/registrar', { method: 'POST', body: dados });
      alert('Cadastro enviado! Aguarde um administrador aprovar seu acesso.');
      navegar('login');
    } catch (err) {
      document.getElementById('erro').textContent = err.message;
    }
  });
}

async function telaLista() {
  app.innerHTML = `${topbar()}<div class="container"><p class="aviso">Carregando processos…</p></div>`;
  const { processos } = await api('/processos');

  app.innerHTML = `
    ${topbar()}
    <div class="container">
      ${podeEditar() ? `<div class="card"><h3 style="margin-top:0">Novo processo</h3>
        <div id="erro" class="erro"></div>
        <form id="form-novo">
          <div class="top-form">
            <input name="titulo" placeholder="Título" required />
            <input name="numero" placeholder="Número" />
          </div>
          <div class="top-form">
            <select name="tipo">
              <option value="emenda">Emenda</option>
              <option value="convenio">Convênio</option>
            </select>
            <input name="parlamentar" placeholder="Parlamentar / origem" />
            <input name="valor" type="number" step="0.01" placeholder="Valor (R$)" />
          </div>
          <button class="btn" type="submit">Criar processo</button>
        </form>
      </div>` : ''}
      <div class="card lista-processos">
        ${processos.length === 0 ? '<p class="aviso">Nenhum processo cadastrado ainda.</p>' : ''}
        ${processos
          .map(
            (p) => `
          <div class="processo-item" data-id="${p.id}">
            <div>
              <strong>${escapeHtml(p.titulo)}</strong>
              <div class="aviso">${p.numero ? `Nº ${escapeHtml(p.numero)} · ` : ''}${escapeHtml(p.parlamentar || '')}</div>
            </div>
            <div style="text-align:right">
              <div>${formatarMoeda(p.valor)}</div>
              <span class="badge" style="background:${p.fase_cor || '#8e8e93'}">${escapeHtml(p.fase_nome || 'Sem fase')}</span>
            </div>
          </div>`
          )
          .join('')}
      </div>
    </div>`;

  app.querySelectorAll('.processo-item').forEach((el) => {
    el.addEventListener('click', () => navegar('detalhe', { id: el.dataset.id }));
  });

  const formNovo = document.getElementById('form-novo');
  if (formNovo) {
    formNovo.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dados = Object.fromEntries(new FormData(e.target));
      dados.valor = Number(dados.valor || 0);
      try {
        await api('/processos', { method: 'POST', body: dados });
        navegar('lista');
      } catch (err) {
        document.getElementById('erro').textContent = err.message;
      }
    });
  }
}

async function telaDetalhe() {
  const id = state.params.id;
  app.innerHTML = `${topbar()}<div class="container"><p class="aviso">Carregando…</p></div>`;
  const { processo } = await api(`/processos/${id}`);

  const fasesAtivas = state.fases.filter((f) => f.ativo || f.id === processo.fase_atual_id);

  app.innerHTML = `
    ${topbar('Processo')}
    <div class="container">
      <button class="btn secondary" data-rota="lista">← Voltar</button>
      <div class="card" style="margin-top:16px">
        <h2 style="margin-top:0">${escapeHtml(processo.titulo)}</h2>
        <p class="aviso">${processo.numero ? `Nº ${escapeHtml(processo.numero)} · ` : ''}${escapeHtml(processo.parlamentar || '')} · ${formatarMoeda(processo.valor)}</p>
        ${processo.descricao ? `<p>${escapeHtml(processo.descricao)}</p>` : ''}

        <div class="timeline">
          ${fasesAtivas
            .map(
              (f) => `<span class="etapa ${f.id === processo.fase_atual_id ? 'ativa' : ''}"
                style="${f.id === processo.fase_atual_id ? `background:${f.cor}` : ''}">${escapeHtml(f.nome)}</span>`
            )
            .join('')}
        </div>

        ${podeEditar() ? `
        <form id="form-avancar" class="top-form">
          <select name="fase_id">
            ${fasesAtivas.map((f) => `<option value="${f.id}" ${f.id === processo.fase_atual_id ? 'selected' : ''}>${escapeHtml(f.nome)}</option>`).join('')}
          </select>
          <input name="observacao" placeholder="Observação (opcional)" />
          <button class="btn" type="submit">Atualizar fase</button>
        </form>` : ''}
      </div>

      <div class="card">
        <h3 style="margin-top:0">Linha do tempo</h3>
        ${processo.historico
          .map(
            (h) => `<div class="historico-item">
              <strong>${escapeHtml(h.fase_nome || '—')}</strong> · ${formatarData(h.criado_em)}
              ${h.usuario_nome ? ` · ${escapeHtml(h.usuario_nome)}` : ''}
              ${h.observacao ? `<div class="aviso">${escapeHtml(h.observacao)}</div>` : ''}
            </div>`
          )
          .join('') || '<p class="aviso">Sem histórico.</p>'}
      </div>

      <div class="card">
        <h3 style="margin-top:0">Anexos</h3>
        ${podeEditar() ? `
        <form id="form-anexo" class="top-form">
          <input type="file" name="arquivo" required />
          <button class="btn" type="submit">Enviar</button>
        </form>` : ''}
        ${processo.anexos
          .map(
            (a) => `<div class="linha-tabela">
              <a href="/api/anexos/${a.id}/download">${escapeHtml(a.nome_original)}</a>
              <span class="aviso">${(a.tamanho / 1024).toFixed(0)} KB</span>
            </div>`
          )
          .join('') || '<p class="aviso">Nenhum anexo.</p>'}
      </div>
    </div>`;

  const formAvancar = document.getElementById('form-avancar');
  if (formAvancar) {
    formAvancar.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dados = Object.fromEntries(new FormData(e.target));
      dados.fase_id = Number(dados.fase_id);
      await api(`/processos/${id}/avancar`, { method: 'POST', body: dados });
      navegar('detalhe', { id });
    });
  }

  const formAnexo = document.getElementById('form-anexo');
  if (formAnexo) {
    formAnexo.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      await api(`/anexos/${id}`, { method: 'POST', body: formData });
      navegar('detalhe', { id });
    });
  }
}

async function telaConfig() {
  const aba = state.params.aba || 'usuarios';
  app.innerHTML = `${topbar('Configurações')}<div class="container"><p class="aviso">Carregando…</p></div>`;

  const [{ usuarios }, { fases }] = await Promise.all([api('/usuarios'), api('/fases')]);

  app.innerHTML = `
    ${topbar('Configurações')}
    <div class="container">
      <div class="tabs">
        <button data-aba="usuarios" class="${aba === 'usuarios' ? 'ativo' : ''}">Usuários</button>
        <button data-aba="fases" class="${aba === 'fases' ? 'ativo' : ''}">Fases da linha do tempo</button>
      </div>

      ${aba === 'usuarios' ? `
      <div class="card">
        ${usuarios
          .map(
            (u) => `<div class="linha-tabela">
              <div>
                <strong>${escapeHtml(u.nome)}</strong>
                <div class="aviso">${escapeHtml(u.email)} · ${u.status}</div>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                ${u.status === 'pendente' ? `<button class="btn" data-aprovar="${u.id}">Aprovar</button>` : ''}
                <select data-papel="${u.id}">
                  ${['administrador', 'editor', 'leitor']
                    .map((p) => `<option value="${p}" ${p === u.papel ? 'selected' : ''}>${p}</option>`)
                    .join('')}
                </select>
                <button class="btn danger" data-excluir="${u.id}">Excluir</button>
              </div>
            </div>`
          )
          .join('')}
      </div>` : ''}

      ${aba === 'fases' ? `
      <div class="card">
        <form id="form-fase" class="top-form">
          <input name="nome" placeholder="Nome da fase" required />
          <input name="cor" type="color" value="#0071e3" style="max-width:60px;padding:2px" />
          <button class="btn" type="submit">Adicionar</button>
        </form>
        ${fases
          .map(
            (f) => `<div class="linha-tabela">
              <span class="badge" style="background:${f.cor}">${escapeHtml(f.nome)}</span>
              <div style="display:flex;gap:8px">
                <button class="btn secondary" data-toggle-fase="${f.id}" data-ativo="${f.ativo}">${f.ativo ? 'Desativar' : 'Ativar'}</button>
              </div>
            </div>`
          )
          .join('')}
      </div>` : ''}
    </div>`;

  app.querySelectorAll('[data-aba]').forEach((el) => {
    el.addEventListener('click', () => navegar('config', { aba: el.dataset.aba }));
  });
  app.querySelectorAll('[data-aprovar]').forEach((el) => {
    el.addEventListener('click', async () => {
      await api(`/usuarios/${el.dataset.aprovar}/aprovar`, { method: 'PATCH' });
      navegar('config', { aba });
    });
  });
  app.querySelectorAll('[data-papel]').forEach((el) => {
    el.addEventListener('change', async () => {
      await api(`/usuarios/${el.dataset.papel}/papel`, { method: 'PATCH', body: { papel: el.value } });
      navegar('config', { aba });
    });
  });
  app.querySelectorAll('[data-excluir]').forEach((el) => {
    el.addEventListener('click', async () => {
      if (!confirm('Excluir este usuário?')) return;
      await api(`/usuarios/${el.dataset.excluir}`, { method: 'DELETE' });
      navegar('config', { aba });
    });
  });
  app.querySelectorAll('[data-toggle-fase]').forEach((el) => {
    el.addEventListener('click', async () => {
      const ativo = el.dataset.ativo === '1';
      await api(`/fases/${el.dataset.toggleFase}`, { method: 'PATCH', body: { ativo: !ativo } });
      navegar('config', { aba });
    });
  });

  const formFase = document.getElementById('form-fase');
  if (formFase) {
    formFase.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dados = Object.fromEntries(new FormData(e.target));
      await api('/fases', { method: 'POST', body: dados });
      const { fases } = await api('/fases');
      state.fases = fases;
      navegar('config', { aba: 'fases' });
    });
  }
}

function mesAtualStr() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
}

function deslocarMes(mes, delta) {
  const [ano, m] = mes.split('-').map(Number);
  const data = new Date(ano, m - 1 + delta, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

function mesLabel(mes) {
  const [ano, m] = mes.split('-').map(Number);
  const data = new Date(ano, m - 1, 1);
  const nome = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

function dataParaInputDate(iso) {
  if (!iso) return new Date().toISOString().slice(0, 10);
  return iso.slice(0, 10);
}

async function telaContas() {
  const mes = state.params.mes || mesAtualStr();
  app.innerHTML = `${topbar('Contas a pagar')}<div class="container"><p class="aviso">Carregando contas…</p></div>`;
  const { contas } = await api(`/contas?mes=${mes}`);

  const totalMes = contas.reduce((soma, c) => soma + Number(c.valor || 0), 0);
  const totalPago = contas.filter((c) => c.pago).reduce((soma, c) => soma + Number(c.valor_pago ?? c.valor ?? 0), 0);
  const totalPendente = totalMes - contas.filter((c) => c.pago).reduce((soma, c) => soma + Number(c.valor || 0), 0);

  app.innerHTML = `
    ${topbar('Contas a pagar')}
    <div class="container">
      <div class="top-form" style="align-items:center">
        <button class="btn secondary" id="mes-anterior">←</button>
        <div style="flex:1;text-align:center;font-weight:600">${mesLabel(mes)}</div>
        <button class="btn secondary" id="mes-proximo">→</button>
      </div>

      <div class="resumo-contas">
        <div class="resumo-item">
          <span class="aviso">Total do mês</span>
          <strong>${formatarMoeda(totalMes)}</strong>
        </div>
        <div class="resumo-item">
          <span class="aviso">Pago</span>
          <strong style="color:#2fa84f">${formatarMoeda(totalPago)}</strong>
        </div>
        <div class="resumo-item">
          <span class="aviso">Pendente</span>
          <strong style="color:${totalPendente > 0 ? 'var(--danger)' : 'inherit'}">${formatarMoeda(totalPendente)}</strong>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top:0">Nova conta</h3>
        <div id="erro-nova" class="erro"></div>
        <form id="form-nova-conta">
          <div class="top-form">
            <input name="descricao" placeholder="Descrição (ex: Aluguel, Internet)" required />
            <input name="valor" type="number" step="0.01" min="0" placeholder="Valor (R$)" required />
          </div>
          <div class="top-form">
            <input name="dia_vencimento" type="number" min="1" max="31" placeholder="Dia do vencimento" />
            <input name="banco" placeholder="Banco (opcional)" />
          </div>
          <button class="btn" type="submit">Adicionar conta</button>
        </form>
      </div>

      <div class="lista-processos">
        ${contas.length === 0 ? '<p class="aviso">Nenhuma conta cadastrada ainda.</p>' : ''}
        ${contas.map((c) => contaCardHtml(c)).join('')}
      </div>
    </div>`;

  document.getElementById('mes-anterior').addEventListener('click', () => navegar('contas', { mes: deslocarMes(mes, -1) }));
  document.getElementById('mes-proximo').addEventListener('click', () => navegar('contas', { mes: deslocarMes(mes, 1) }));

  document.getElementById('form-nova-conta').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(e.target));
    dados.valor = Number(dados.valor || 0);
    dados.dia_vencimento = dados.dia_vencimento ? Number(dados.dia_vencimento) : null;
    try {
      await api('/contas', { method: 'POST', body: dados });
      navegar('contas', { mes });
    } catch (err) {
      document.getElementById('erro-nova').textContent = err.message;
    }
  });

  ligarAcoesContas(mes);
}

function contaCardHtml(c) {
  return `
    <div class="card conta-item ${c.pago ? 'paga' : ''}" data-id="${c.id}">
      <div class="conta-topo">
        <div>
          <strong>${escapeHtml(c.descricao)}</strong>
          <div class="aviso">
            ${c.dia_vencimento ? `Vence dia ${c.dia_vencimento} · ` : ''}${formatarMoeda(c.valor)}
            ${c.banco ? ` · ${escapeHtml(c.banco)}` : ''}
          </div>
        </div>
        <span class="badge" style="background:${c.pago ? '#2fa84f' : '#ff9500'}">${c.pago ? 'Pago' : 'Pendente'}</span>
      </div>

      ${c.pago
        ? `<div class="aviso" style="margin-top:10px">
             Pago em ${formatarDataSimples(c.data_pagamento)}${c.banco_pagamento ? ` · ${escapeHtml(c.banco_pagamento)}` : ''}
             ${c.valor_pago != null ? ` · ${formatarMoeda(c.valor_pago)}` : ''}
           </div>
           <button class="btn secondary" data-desfazer="${c.id}" style="margin-top:10px">Desfazer pagamento</button>`
        : `<form class="form-pagar top-form" data-pagar="${c.id}" style="margin-top:10px">
             <input type="date" name="data_pagamento" value="${dataParaInputDate(null)}" required />
             <input name="banco" placeholder="Banco" value="${escapeHtml(c.banco || '')}" />
             <input name="valor_pago" type="number" step="0.01" min="0" placeholder="Valor pago" value="${c.valor}" />
             <button class="btn" type="submit">Marcar como pago</button>
           </form>`}
      <div style="margin-top:10px;display:flex;gap:8px">
        <button class="btn secondary" data-excluir-conta="${c.id}">Excluir conta</button>
      </div>
    </div>`;
}

function formatarDataSimples(iso) {
  if (!iso) return '';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

function ligarAcoesContas(mes) {
  app.querySelectorAll('.form-pagar').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = form.dataset.pagar;
      const dados = Object.fromEntries(new FormData(form));
      dados.mes_referencia = mes;
      dados.valor_pago = dados.valor_pago ? Number(dados.valor_pago) : null;
      await api(`/contas/${id}/pagar`, { method: 'POST', body: dados });
      navegar('contas', { mes });
    });
  });

  app.querySelectorAll('[data-desfazer]').forEach((el) => {
    el.addEventListener('click', async () => {
      await api(`/contas/${el.dataset.desfazer}/desfazer`, { method: 'POST', body: { mes_referencia: mes } });
      navegar('contas', { mes });
    });
  });

  app.querySelectorAll('[data-excluir-conta]').forEach((el) => {
    el.addEventListener('click', async () => {
      if (!confirm('Excluir esta conta? Ela deixará de aparecer nos próximos meses.')) return;
      await api(`/contas/${el.dataset.excluirConta}`, { method: 'DELETE' });
      navegar('contas', { mes });
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

carregarSessao();
