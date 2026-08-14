<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in 
ode_modules/next/dist/docs/ (resolved from this file's directory; in monorepos the 
ext package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by 
ext dev — verify at 
ode_modules/next/dist/server/lib/generate-agent-files.js. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# DIRETRIZES DO PROJETO FIXUM

## 1. RESPONSIVIDADE E MOBILE-FIRST (OBRIGATÓRIO)
- TODA a aplicação, telas, modais, formulários e componentes DEVEM ser 100% funcionais, bonitos e adaptados para CELULAR (telas pequenas, touch) e DESKTOP.
- Usar grids responsivos (grid-template-columns: repeat(auto-fit, minmax(...)), 1fr no mobile, etc.).
- Containers devem ser centralizados (margin: 0 auto, max-width, width: 100%) com padding lateral adequado para não vazar a tela nem gerar scroll horizontal indesejado.
- Botões e áreas de toque com no mínimo 44px de altura para facilitar o toque no celular.
- Formulários com inputs legíveis em telas pequenas (font-size 16px para evitar auto-zoom no iOS).

## 2. IDIOMA E NOMENCLATURA
- Sempre pensar, conversar e programar em Português.
- Nomes de campos e tabelas consistentes com o banco de dados Supabase.

## 3. BANCO DE DADOS
- Supabase é o backend e banco de dados oficial do projeto.
- Tabelas: imoveis (campos: latitude, longitude, preco, 	ipo, 
egociacao, airro, cidade, etc.), otos_imovel (campos: id, imovel_id, url, principal, ordem), perfis, etc.
- Storage: bucket otos-imoveis (público).