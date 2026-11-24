// Generates concept-only HTML screens for the Figma reference pack.
// Each page carries a CONCEPT ribbon + fictional-data notice.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'concepts');

const nav = (links, sub) => `
<header class="site-nav">
  <a class="site-wordmark" href="#"><img src="repassa.webp" alt=""/><strong>RePassa</strong></a>
  <nav class="nav-links">${links}</nav>
</header>
${sub ? `<nav class="sub-nav">${sub}</nav>` : ''}`;

const visitorNav = nav(`<a href="#">Acervo</a><a href="#">Como funciona</a><a class="button" href="#">Entrar ↗</a>`);
const studentNav = nav(
  `<a href="#">Acervo</a><a href="#">Como funciona</a><a class="button" href="#">Sair ⇥</a>`,
  `<a href="#">Doar material</a><a href="#">Minhas doações</a><a href="#" aria-current="page">Minhas reservas</a><a href="#">Meu perfil</a>`,
);
const instNav = nav(
  `<a href="#">Acervo</a><a class="button" href="#">Sair ⇥</a>`,
  `<a href="#">Visão geral</a><a href="#">Recebimentos</a><a href="#">Estoque</a><a href="#" aria-current="page">Retiradas</a>`,
);
const adminNav = nav(
  `<a href="#">Painel</a><a href="#">Instituições</a><a href="#">Usuários</a><a href="#">Materiais</a><a href="#">Auditoria</a><a class="button" href="#">Sair ⇥</a>`,
);

const foot = `
<div class="concept-note">Tela CONCEPT para referência de design — ainda não implementada. Todos os dados são fictícios e servem apenas para composição visual.</div>
<footer class="site-foot"><span>RePassa · Rede de reuso educacional</span><span>Conceito visual — dados fictícios</span></footer>`;

function page(file, title, navHtml, body) {
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title} · RePassa (conceito)</title>
<link rel="stylesheet" href="concept.css"/>
</head>
<body>
<div class="concept-ribbon">CONCEPT</div>
${navHtml}
${body}
${foot}
</body>
</html>`;
  writeFileSync(join(DIR, file + '.html'), html, 'utf8');
  console.log('wrote ' + file + '.html');
}

const status = (s, label) => `<span class="status" data-status="${s}">● ${label}</span>`;
const thumb = (t, c) => `<div class="item-thumb" data-cat="${c}"><span>${t}</span></div>`;

/* ---------------- Visitor ---------------- */
page('V06-recuperar-senha-CONCEPT', 'Recuperar senha', visitorNav, `
<main class="frame" style="max-width:640px;margin:0 auto;">
  <div class="page-head">
    <p class="eyebrow">Acesso à conta</p>
    <h1>Recuperar <em>senha.</em></h1>
    <p class="lede">Informe o e-mail da sua conta. Se ele estiver cadastrado, enviaremos um link para criar uma nova senha. O link expira em 1 hora.</p>
  </div>
  <form class="card" style="margin-top:20px;">
    <div class="field"><label for="email">E-mail</label><input id="email" type="email" placeholder="seu.email@exemplo.com"/></div>
    <button class="button primary" type="button">Enviar link de recuperação →</button>
  </form>
  <div class="notice" style="margin-top:22px;"><span>✉</span><span>Se o e-mail estiver cadastrado, você receberá as instruções em instantes. Por segurança, não confirmamos se a conta existe.</span></div>
  <p style="margin-top:22px;"><a href="#">Voltar para entrar</a></p>
</main>`);

/* ---------------- Student concepts ---------------- */
page('E05-minhas-reservas-CONCEPT', 'Minhas reservas', studentNav, `
<main class="frame">
  <div class="page-head">
    <p class="eyebrow">Área do estudante</p>
    <h1>Minhas <em>reservas.</em></h1>
    <p class="lede">Apresente o código na instituição dentro do prazo para retirar o material.</p>
  </div>
  <ul class="item-list" style="margin-top:26px;">
    <li class="item-card">
      ${thumb('Livros', 'Livros')}
      <div>
        <h3>Botânica ilustrada</h3>
        <p class="item-meta">Instituto Folha Nova · Alameda das Folhas, 24 — Vila Mariana</p>
        ${status('ACTIVE', 'Reserva ativa')}
        <div class="pickup-code"><span>Código para retirada</span><strong>K7N2-P4XQ-9M3B</strong><small>Retire até 25 de nov. de 2026, 23:59 (horário de Brasília).</small></div>
      </div>
      <div style="display:grid;gap:10px;justify-items:end;">
        <button class="button small">Copiar código ⧉</button>
        <button class="button small danger">Cancelar reserva</button>
      </div>
    </li>
    <li class="item-card">
      ${thumb('Materiais', 'Materiais')}
      <div>
        <h3>Kit régua e esquadro</h3>
        <p class="item-meta">Centro Comunitário Semente · retirada realizada</p>
        ${status('COMPLETED', 'Retirado em 18 nov.')}
      </div>
    </li>
    <li class="item-card">
      ${thumb('Livros', 'Livros')}
      <div>
        <h3>Atlas geográfico do Brasil</h3>
        <p class="item-meta">Instituto Folha Nova · prazo encerrado sem retirada</p>
        ${status('EXPIRED', 'Expirada')}
      </div>
    </li>
  </ul>
</main>`);

page('E06-reserva-cancelar-CONCEPT', 'Cancelar reserva', studentNav, `
<main class="frame">
  <div class="page-head">
    <p class="eyebrow">Área do estudante</p>
    <h1>Minhas <em>reservas.</em></h1>
  </div>
  <div style="display:flex;justify-content:center;padding:60px 0;">
    <div class="dialog" role="alertdialog" aria-labelledby="dlg-t">
      <h2 id="dlg-t">Cancelar esta reserva?</h2>
      <p>O código <strong>K7N2-P4XQ-9M3B</strong> deixa de valer e <strong>Botânica ilustrada</strong> volta a ficar disponível para outros estudantes.</p>
      <div class="actions">
        <button class="button">Manter reserva</button>
        <button class="button primary danger" style="background:#733e30;border-color:#733e30;color:var(--ivory);">Sim, cancelar</button>
      </div>
    </div>
  </div>
</main>`);

page('E11-conta-dados-CONCEPT', 'Dados da conta', studentNav, `
<main class="frame">
  <div class="page-head">
    <p class="eyebrow">Área do estudante</p>
    <h1>Meus <em>dados.</em></h1>
    <p class="lede">Gerencie as informações da sua conta conforme a LGPD.</p>
  </div>
  <div class="card" style="max-width:640px;margin-top:24px;">
    <h2 style="font-size:1.6rem;">Exportar meus dados</h2>
    <p class="item-meta" style="margin:8px 0 16px;">Receba por e-mail um arquivo com perfil, doações e reservas.</p>
    <button class="button">Solicitar exportação ↓</button>
  </div>
  <div class="card" style="max-width:640px;margin-top:18px;border-color:#733e30;">
    <h2 style="font-size:1.6rem;color:#733e30;">Encerrar conta</h2>
    <p class="item-meta" style="margin:8px 0 16px;">A exclusão remove seu acesso e anonimiza registros. Materiais já entregues permanecem no histórico institucional.</p>
    <button class="button danger">Solicitar exclusão</button>
  </div>
</main>`);

/* ---------------- Institution concepts ---------------- */
page('I05-retirada-codigo-CONCEPT', 'Confirmar retirada', instNav, `
<main class="frame" style="max-width:760px;">
  <div class="page-head">
    <p class="eyebrow">Área da instituição</p>
    <h1>Confirmar <em>retirada.</em></h1>
    <p class="lede">Digite o código apresentado pelo estudante. A confirmação é única e definitiva — faça-a somente com o material em mãos.</p>
  </div>
  <form class="card" style="margin-top:24px;max-width:560px;">
    <div class="field">
      <label for="code">Código de retirada</label>
      <input id="code" type="text" placeholder="XXXX-XXXX-XXXX" style="font-family:var(--serif);font-size:1.6rem;letter-spacing:0.14em;text-transform:uppercase;" autocomplete="off"/>
      <p class="hint">Formato: 3 grupos de 4 caracteres. Letras parecidas como O e 0 não são usadas.</p>
    </div>
    <button class="button primary" type="button">Validar código →</button>
  </form>
</main>`);

page('I06-retirada-confirmada-CONCEPT', 'Retirada confirmada', instNav, `
<main class="frame" style="max-width:760px;">
  <div class="page-head">
    <p class="eyebrow">Área da instituição</p>
    <h1>Confirmar <em>retirada.</em></h1>
  </div>
  <div class="card" style="margin-top:24px;max-width:620px;">
    ${status('RESERVED', 'Reserva encontrada')}
    <h2 style="margin-top:14px;">Botânica ilustrada</h2>
    <p class="item-meta">Reservado por estudante · código K7N2-P4XQ-9M3B · válido até 25 nov. 2026</p>
    <div class="notice warn" style="margin-top:18px;"><span>⚠</span><span>Entregue o material fisicamente ao estudante antes de confirmar. Esta ação não pode ser desfeita.</span></div>
    <div class="actions" style="display:flex;gap:12px;margin-top:20px;">
      <button class="button">Cancelar</button>
      <button class="button primary">Confirmar entrega do material ✓</button>
    </div>
  </div>
  <div class="notice" style="margin-top:20px;"><span>✓</span><span><strong>Retirada registrada.</strong> Botânica ilustrada marcado como retirado às 14:32. Pronto para o próximo código.</span></div>
</main>`);

page('I07-cadastro-instituicao-CONCEPT', 'Cadastre sua instituição', visitorNav, `
<main class="frame" style="max-width:860px;">
  <div class="page-head">
    <p class="eyebrow">Seja um ponto parceiro</p>
    <h1>Cadastre sua <em>instituição.</em></h1>
    <p class="lede">Instituições são pontos físicos parceiros onde doações são recebidas e materiais retirados. O cadastro passa por análise da equipe RePassa.</p>
  </div>
  <form class="card" style="margin-top:24px;">
    <div class="form-grid">
      <div class="field"><label>Nome da instituição</label><input value="Instituto Horizonte"/></div>
      <div class="field"><label>CNPJ (opcional)</label><input placeholder="00.000.000/0000-00"/></div>
      <div class="field"><label>Endereço público</label><input value="Rua das Hortências, 180 — Bom Retiro, São Paulo/SP"/></div>
      <div class="field"><label>Telefone de contato</label><input value="(11) 3222-0140"/></div>
    </div>
    <div class="field"><label>Instruções de retirada</label><textarea rows="3">Informe o código na recepção da biblioteca, das 8h às 18h.</textarea><p class="hint">Exibidas ao estudante após a reserva.</p></div>
    <div class="field"><label>E-mail do responsável (primeiro membro)</label><input value="coordenacao@horizonte.example.invalid"/></div>
    <button class="button primary" type="button">Enviar para análise →</button>
  </form>
  <div class="notice" style="margin-top:22px;"><span>ℹ</span><span>Após a aprovação, o responsável recebe acesso à área da instituição para confirmar recebimentos e retiradas.</span></div>
</main>`);

page('I08-equipe-CONCEPT', 'Equipe da instituição', instNav.replace('Retiradas', 'Equipe').replace('aria-current="page">Retiradas', '>Retiradas').replace('>Equipe<', ' aria-current="page">Equipe<'), `
<main class="frame" style="max-width:900px;">
  <div class="page-head">
    <p class="eyebrow">Área da instituição</p>
    <h1>Equipe do <em>ponto.</em></h1>
    <p class="lede">Membros autorizados a confirmar recebimentos e retiradas no Instituto Folha Nova.</p>
  </div>
  <table style="margin-top:24px;">
    <thead><tr><th>Membro</th><th>E-mail</th><th>Função</th><th>Status</th><th></th></tr></thead>
    <tbody>
      <tr><td>Marta Souza</td><td>funcionaria.marta@example.invalid</td><td>Coordenadora</td><td>${status('COMPLETED', 'Ativa')}</td><td><button class="button small">Remover</button></td></tr>
      <tr><td>Rafael Mendes</td><td>funcionario.rafael@example.invalid</td><td>Operador</td><td>${status('COMPLETED', 'Ativa')}</td><td><button class="button small">Remover</button></td></tr>
      <tr><td>Juliana Prado</td><td>juliana.prado@example.invalid</td><td>Operadora</td><td>${status('ACTIVE', 'Convite pendente')}</td><td><button class="button small">Reenviar</button></td></tr>
    </tbody>
  </table>
  <div class="card" style="margin-top:24px;max-width:520px;">
    <h2 style="font-size:1.5rem;">Adicionar membro</h2>
    <div class="field" style="margin-top:12px;"><label>E-mail institucional</label><input placeholder="nome@instituicao.example.invalid"/></div>
    <button class="button primary" type="button">Enviar convite →</button>
  </div>
</main>`);

page('I09-historico-CONCEPT', 'Histórico do ponto', instNav.replace('aria-current="page">Retiradas', '>Retiradas').replace('</a>\n', '</a>\n'), `
<main class="frame" style="max-width:900px;">
  <div class="page-head">
    <p class="eyebrow">Área da instituição</p>
    <h1>Histórico de <em>circulação.</em></h1>
    <p class="lede">Registro das operações no Instituto Folha Nova.</p>
  </div>
  <div class="filter-row">
    <div class="field" style="margin:0;"><label>Período</label><select><option>Últimos 30 dias</option><option>Últimos 90 dias</option><option>Todo o período</option></select></div>
    <div class="field" style="margin:0;"><label>Operação</label><select><option>Todas</option><option>Recebimentos</option><option>Retiradas</option><option>Recusas</option></select></div>
    <button class="button">Filtrar →</button>
  </div>
  <ul class="timeline" style="margin-top:20px;">
    <li><time>19 nov. 2026, 14:32</time><p><strong>Retirada confirmada</strong> — Botânica ilustrada entregue a estudante (Marta Souza).</p></li>
    <li><time>18 nov. 2026, 09:30</time><p><strong>Recebimento confirmado</strong> — Caderno pautado 96 folhas entrou no acervo (Rafael Mendes).</p></li>
    <li><time>12 nov. 2026, 16:20</time><p><strong>Doação recusada</strong> — Atlas geográfico do Brasil, motivo: páginas soltas (Marta Souza).</p></li>
    <li><time>10 nov. 2026, 13:05</time><p><strong>Recebimento confirmado</strong> — Gramática completa entrou no acervo (Marta Souza).</p></li>
  </ul>
</main>`);

/* ---------------- Admin concepts ---------------- */
page('A01-admin-dashboard-CONCEPT', 'Painel administrativo', adminNav, `
<main class="frame">
  <div class="page-head">
    <p class="eyebrow">Administração</p>
    <h1>Painel <em>RePassa.</em></h1>
    <p class="lede">Visão geral da rede de reuso educacional.</p>
  </div>
  <div class="stat-row">
    <div><span>Instituições ativas</span><strong>3</strong></div>
    <div><span>Estudantes cadastrados</span><strong>128</strong></div>
    <div><span>Materiais disponíveis</span><strong>46</strong></div>
    <div><span>Retiradas no mês</span><strong>19</strong></div>
    <div><span>Aprovações pendentes</span><strong>2</strong></div>
  </div>
  <div class="notice warn"><span>⚠</span><span><strong>2 instituições aguardam análise</strong> — Centro de Estudos Aurora e Biblioteca Comunitária Raízes. <a href="#">Revisar cadastros</a></span></div>
  <section class="section" style="padding-left:0;padding-right:0;">
    <h2 style="font-size:1.6rem;margin:26px 0 14px;">Atividade recente</h2>
    <ul class="timeline">
      <li><time>há 12 min</time><p>Reserva criada — Instituto Folha Nova.</p></li>
      <li><time>há 1 h</time><p>Nova doação cadastrada — Centro Comunitário Semente.</p></li>
      <li><time>há 3 h</time><p>Instituição Centro de Estudos Aurora enviou cadastro.</p></li>
    </ul>
  </section>
</main>`);

page('A02-admin-instituicoes-CONCEPT', 'Instituições', adminNav, `
<main class="frame">
  <div class="page-head">
    <p class="eyebrow">Administração</p>
    <h1>Instituições <em>parceiras.</em></h1>
  </div>
  <div class="filter-row">
    <input placeholder="Buscar por nome ou cidade"/>
    <select><option>Todos os status</option><option>Ativas</option><option>Pendentes</option><option>Suspensas</option></select>
    <button class="button">Filtrar →</button>
    <button class="button primary" style="margin-left:auto;">+ Cadastrar instituição</button>
  </div>
  <table>
    <thead><tr><th>Instituição</th><th>Endereço</th><th>Membros</th><th>Materiais</th><th>Status</th></tr></thead>
    <tbody>
      <tr><td>Instituto Folha Nova</td><td>Vila Mariana, São Paulo/SP</td><td>3</td><td>18</td><td>${status('COMPLETED', 'Ativa')}</td></tr>
      <tr><td>Centro Comunitário Semente</td><td>Santo Amaro, São Paulo/SP</td><td>2</td><td>11</td><td>${status('COMPLETED', 'Ativa')}</td></tr>
      <tr><td>Centro de Estudos Aurora</td><td>Santana, São Paulo/SP</td><td>1</td><td>0</td><td>${status('ACTIVE', 'Pendente')}</td></tr>
      <tr><td>Biblioteca Comunitária Raízes</td><td>Capão Redondo, São Paulo/SP</td><td>1</td><td>0</td><td>${status('ACTIVE', 'Pendente')}</td></tr>
    </tbody>
  </table>
</main>`);

page('A03-admin-instituicao-detalhe-CONCEPT', 'Instituição — detalhe', adminNav, `
<main class="frame" style="max-width:900px;">
  <div class="page-head">
    <p class="eyebrow">Administração · Instituições</p>
    <h1>Instituto Folha <em>Nova.</em></h1>
    <p class="lede">Alameda das Folhas, 24 — Vila Mariana, São Paulo/SP</p>
  </div>
  <div class="stat-row">
    <div><span>Recebidos</span><strong>74</strong></div>
    <div><span>Disponíveis</span><strong>18</strong></div>
    <div><span>Reservados</span><strong>5</strong></div>
    <div><span>Entregues</span><strong>51</strong></div>
  </div>
  <h2 style="font-size:1.6rem;margin:26px 0 12px;">Equipe vinculada</h2>
  <table>
    <thead><tr><th>Membro</th><th>E-mail</th><th>Status</th><th></th></tr></thead>
    <tbody>
      <tr><td>Marta Souza</td><td>funcionaria.marta@example.invalid</td><td>${status('COMPLETED', 'Ativa')}</td><td><button class="button small">Desvincular</button></td></tr>
      <tr><td>Rafael Mendes</td><td>funcionario.rafael@example.invalid</td><td>${status('COMPLETED', 'Ativa')}</td><td><button class="button small">Desvincular</button></td></tr>
    </tbody>
  </table>
  <div class="actions" style="display:flex;gap:12px;margin-top:26px;">
    <button class="button">Editar dados</button>
    <button class="button danger">Suspender ponto</button>
  </div>
</main>`);

page('A04-admin-usuarios-CONCEPT', 'Usuários', adminNav, `
<main class="frame">
  <div class="page-head">
    <p class="eyebrow">Administração</p>
    <h1>Usuários da <em>plataforma.</em></h1>
  </div>
  <div class="filter-row">
    <input placeholder="Buscar por nome ou e-mail"/>
    <select><option>Todas as funções</option><option>Estudantes</option><option>Instituição</option><option>Administradores</option></select>
    <select><option>Todos os status</option><option>Ativos</option><option>Desativados</option></select>
    <button class="button">Filtrar →</button>
  </div>
  <table>
    <thead><tr><th>Nome</th><th>E-mail</th><th>Função</th><th>Vínculo</th><th>Status</th></tr></thead>
    <tbody>
      <tr><td>Ana Beatriz Lima</td><td>ana.aluna@example.invalid</td><td>Estudante</td><td>—</td><td>${status('COMPLETED', 'Ativa')}</td></tr>
      <tr><td>Bruno Carvalho</td><td>bruno.aluno@example.invalid</td><td>Estudante</td><td>—</td><td>${status('COMPLETED', 'Ativa')}</td></tr>
      <tr><td>Marta Souza</td><td>funcionaria.marta@example.invalid</td><td>Instituição</td><td>Folha Nova</td><td>${status('COMPLETED', 'Ativa')}</td></tr>
      <tr><td>Diego Ramos</td><td>diego.ramos@example.invalid</td><td>Estudante</td><td>—</td><td>${status('CANCELED', 'Desativada')}</td></tr>
    </tbody>
  </table>
</main>`);

page('A05-admin-usuario-detalhe-CONCEPT', 'Usuário — detalhe', adminNav, `
<main class="frame" style="max-width:860px;">
  <div class="page-head">
    <p class="eyebrow">Administração · Usuários</p>
    <div style="display:flex;gap:16px;align-items:center;margin-top:16px;"><span class="avatar">AL</span><h1 style="margin:0;">Ana Beatriz Lima</h1></div>
    <p class="lede" style="margin-top:8px;">ana.aluna@example.invalid · Estudante · cadastro em 04 set. 2026</p>
  </div>
  <div class="stat-row">
    <div><span>Doações</span><strong>5</strong></div>
    <div><span>Reservas</span><strong>7</strong></div>
    <div><span>Retiradas</span><strong>4</strong></div>
  </div>
  <h2 style="font-size:1.6rem;margin:26px 0 12px;">Atividade recente</h2>
  <ul class="timeline">
    <li><time>20 nov. 2026</time><p>Reservou Botânica ilustrada — Instituto Folha Nova.</p></li>
    <li><time>18 nov. 2026</time><p>Cadastrou doação Caderno pautado — Centro Semente.</p></li>
  </ul>
  <div class="actions" style="display:flex;gap:12px;margin-top:26px;">
    <button class="button">Redefinir sessão</button>
    <button class="button danger">Desativar conta</button>
  </div>
</main>`);

page('A06-admin-materiais-CONCEPT', 'Materiais', adminNav, `
<main class="frame">
  <div class="page-head">
    <p class="eyebrow">Administração</p>
    <h1>Todos os <em>materiais.</em></h1>
    <p class="lede">Visão somente leitura — status mudam apenas pelo fluxo de doação e retirada.</p>
  </div>
  <div class="filter-row">
    <input placeholder="Buscar por título"/>
    <select><option>Todos os status</option><option>Aguardando entrega</option><option>Disponível</option><option>Reservado</option><option>Retirado</option></select>
    <select><option>Todas as instituições</option><option>Folha Nova</option><option>Semente</option></select>
    <button class="button">Filtrar →</button>
  </div>
  <table>
    <thead><tr><th>Material</th><th>Categoria</th><th>Instituição</th><th>Status</th><th>Atualizado</th></tr></thead>
    <tbody>
      <tr><td>Botânica ilustrada</td><td>Livros</td><td>Folha Nova</td><td>${status('RESERVED', 'Reservado')}</td><td>19 nov.</td></tr>
      <tr><td>Caderno pautado 96 folhas</td><td>Cadernos</td><td>Semente</td><td>${status('PENDING_RECEIPT', 'Aguardando')}</td><td>18 nov.</td></tr>
      <tr><td>Gramática completa</td><td>Livros</td><td>Folha Nova</td><td>${status('AVAILABLE', 'Disponível')}</td><td>10 nov.</td></tr>
      <tr><td>Atlas geográfico do Brasil</td><td>Livros</td><td>Semente</td><td>${status('REJECTED', 'Recusado')}</td><td>12 nov.</td></tr>
    </tbody>
  </table>
</main>`);

page('A07-admin-reservas-CONCEPT', 'Reservas', adminNav, `
<main class="frame">
  <div class="page-head">
    <p class="eyebrow">Administração</p>
    <h1>Reservas e <em>retiradas.</em></h1>
    <p class="lede">Códigos nunca são exibidos aqui — apenas status e prazos.</p>
  </div>
  <table style="margin-top:24px;">
    <thead><tr><th>Reserva</th><th>Material</th><th>Instituição</th><th>Status</th><th>Expira em</th></tr></thead>
    <tbody>
      <tr><td>#5C68D9</td><td>Botânica ilustrada</td><td>Folha Nova</td><td>${status('ACTIVE', 'Ativa')}</td><td>25 nov. 23:59</td></tr>
      <tr><td>#9A1B3D</td><td>Kit régua e esquadro</td><td>Semente</td><td>${status('COMPLETED', 'Retirada')}</td><td>—</td></tr>
      <tr><td>#77EF02</td><td>Atlas geográfico</td><td>Folha Nova</td><td>${status('EXPIRED', 'Expirada')}</td><td>14 nov.</td></tr>
      <tr><td>#B02C11</td><td>Gramática completa</td><td>Folha Nova</td><td>${status('CANCELED', 'Cancelada')}</td><td>—</td></tr>
    </tbody>
  </table>
</main>`);

page('A08-admin-auditoria-CONCEPT', 'Auditoria', adminNav, `
<main class="frame">
  <div class="page-head">
    <p class="eyebrow">Administração</p>
    <h1>Trilha de <em>auditoria.</em></h1>
    <p class="lede">Eventos de segurança e operações. Códigos de retirada nunca são registrados.</p>
  </div>
  <div class="filter-row">
    <input placeholder="Buscar por evento ou ator"/>
    <select><option>Todos os tipos</option><option>Autenticação</option><option>Doações</option><option>Reservas</option><option>Retiradas</option><option>Admin</option></select>
    <button class="button">Filtrar →</button>
  </div>
  <table>
    <thead><tr><th>Data/hora</th><th>Evento</th><th>Ator</th><th>Contexto</th></tr></thead>
    <tbody>
      <tr><td>20 nov. 14:32</td><td>RESERVATION_CREATED</td><td>estudante #84F3</td><td>material #39EA · Folha Nova</td></tr>
      <tr><td>20 nov. 14:01</td><td>AUTH_LOGIN</td><td>funcionária #9C21</td><td>—</td></tr>
      <tr><td>19 nov. 16:44</td><td>PICKUP_CONFIRMED</td><td>funcionária #9C21</td><td>reserva #9A1B · Semente</td></tr>
      <tr><td>19 nov. 09:30</td><td>MATERIAL_RECEIVED</td><td>funcionário #4D77</td><td>material #32FF · Semente</td></tr>
      <tr><td>18 nov. 11:12</td><td>RESERVATION_EXPIRED</td><td>sistema</td><td>reserva #77EF · Folha Nova</td></tr>
    </tbody>
  </table>
</main>`);

page('A09-admin-configuracoes-CONCEPT', 'Configurações', adminNav, `
<main class="frame" style="max-width:760px;">
  <div class="page-head">
    <p class="eyebrow">Administração</p>
    <h1>Configurações da <em>plataforma.</em></h1>
  </div>
  <div class="card" style="margin-top:24px;">
    <h2 style="font-size:1.5rem;">Regras de reserva</h2>
    <div class="form-grid" style="margin-top:14px;">
      <div class="field"><label>Prazo de retirada (dias)</label><input value="5"/></div>
      <div class="field"><label>Reservas ativas por estudante</label><input value="3"/></div>
    </div>
    <button class="button primary" type="button">Salvar alterações</button>
  </div>
  <div class="card" style="margin-top:18px;">
    <h2 style="font-size:1.5rem;">Administradores</h2>
    <table style="margin-top:12px;">
      <tbody>
        <tr><td>Owner</td><td>owner@example.invalid</td><td>${status('COMPLETED', 'Ativo')}</td></tr>
      </tbody>
    </table>
    <button class="button" type="button" style="margin-top:14px;">+ Convidar administrador</button>
  </div>
</main>`);

page('A10-admin-relatorios-CONCEPT', 'Relatórios', adminNav, `
<main class="frame">
  <div class="page-head">
    <p class="eyebrow">Administração</p>
    <h1>Relatórios de <em>impacto.</em></h1>
    <p class="lede">Indicadores de circulação para prestação de contas — sem dados pessoais.</p>
  </div>
  <div class="stat-row">
    <div><span>Materiais reutilizados (total)</span><strong>51</strong></div>
    <div><span>Taxa de retirada</span><strong>82%</strong></div>
    <div><span>Tempo médio até retirada</span><strong>3,2d</strong></div>
  </div>
  <table style="margin-top:20px;">
    <thead><tr><th>Instituição</th><th>Recebidos</th><th>Entregues</th><th>Taxa</th></tr></thead>
    <tbody>
      <tr><td>Instituto Folha Nova</td><td>74</td><td>51</td><td>69%</td></tr>
      <tr><td>Centro Comunitário Semente</td><td>32</td><td>24</td><td>75%</td></tr>
    </tbody>
  </table>
  <button class="button" style="margin-top:20px;">Exportar CSV ↓</button>
</main>`);
