# 🥩 Totem de Açougue

Sistema de autoatendimento para o setor de açougue, desenvolvido para facilitar a seleção de produtos e a geração de pedidos pelos clientes.

A aplicação oferece uma interface intuitiva, responsiva e adaptada para utilização em totens, computadores, tablets e dispositivos móveis.

## 📌 Sobre o projeto

O Totem de Açougue tem como objetivo modernizar o processo de atendimento, permitindo que os clientes consultem os produtos disponíveis, selecionem quantidades e gerem pedidos de maneira prática.

O sistema possui integração com o **ERP TOTVS WinThor**, utilizando o banco de dados Oracle para consultar informações dos produtos, preços, estoque e dados necessários ao processamento dos pedidos.

O projeto foi desenvolvido com uma arquitetura separada em frontend e backend.

## 🚀 Funcionalidades

- Validação de CPF para acesso ao catálogo.
- Integração com o cadastro de clientes do WinThor.
- Consulta de produtos diretamente no banco Oracle.
- Exibição de preços e disponibilidade de estoque.
- Exibição de imagens dos produtos cadastradas no WinThor.
- Organização dos produtos por categorias.
- Pesquisa de produtos por nome.
- Seleção de produtos e ajuste de quantidades.
- Carrinho com cálculo do valor estimado do pedido.
- Modal de revisão e confirmação dos produtos.
- Registro de pedidos no banco de dados Oracle.
- Geração de senha de identificação do pedido.
- Interface responsiva para computadores e dispositivos móveis.
- Rodapé fixo em dispositivos móveis para facilitar o acesso ao carrinho.

## 🛠️ Tecnologias utilizadas

### Frontend

- **React** — construção da interface.
- **JavaScript** — lógica e interatividade.
- **Vite** — ambiente de desenvolvimento.
- **CSS3** — estilização e responsividade.

### Backend

- **Node.js** — execução do servidor.
- **Express** — criação das rotas da API.
- **Oracle Database** — persistência e consulta de dados.
- **OracleDB** — comunicação entre Node.js e Oracle.

### Ferramentas

- Visual Studio Code
- Git e GitHub
- Oracle SQL Developer
- ERP TOTVS WinThor

## 🏗️ Arquitetura da aplicação

O projeto utiliza uma arquitetura cliente-servidor:

```text
Cliente
   |
   v
Frontend React + Vite
   |
   | Requisições HTTP
   v
Backend Node.js + Express
   |
   | Consultas SQL
   v
Oracle Database
   |
   v
ERP TOTVS WinThor
```

O frontend é responsável pela experiência do usuário, enquanto o backend processa as requisições, executa consultas ao banco e registra os pedidos.

## 📂 Estrutura do projeto

```text
totem-acougue/
|
|-- frontend/
|   |-- public/
|   |-- src/
|   |-- package.json
|   |-- vite.config.js
|
|-- backend/
|   |-- src/
|   |   |-- database/
|   |-- package.json
|
|-- .gitignore
|-- README.md
```

## 💻 Executando o projeto localmente

### Pré-requisitos

- Node.js e npm instalados.
- Acesso autorizado ao banco Oracle.
- Oracle Client configurado, quando necessário.
- Variáveis de ambiente do backend configuradas.

### 1. Clonar o repositório

```bash
git clone https://github.com/jeanvalente0998/totem-a-ougue.git
cd totem-a-ougue
```

### 2. Instalar as dependências do backend

```bash
cd backend
npm install
```

Configure as variáveis de ambiente necessárias para a conexão com o banco de dados.

As credenciais não são disponibilizadas no repositório.

### 3. Iniciar o backend

```bash
npm run dev
```

### 4. Instalar as dependências do frontend

Em outro terminal:

```bash
cd frontend
npm install
```

### 5. Iniciar o frontend

```bash
npm run dev
```

Acesse a aplicação pelo endereço informado pelo Vite, normalmente:

`http://localhost:5173`

**Observação:** a execução completa depende de acesso autorizado ao ambiente Oracle WinThor. O comando de inicialização do backend deve ser conferido com os scripts disponíveis em seu `package.json`.

## 📱 Interface responsiva

A aplicação foi desenvolvida para oferecer uma experiência adequada em diferentes tamanhos de tela.

Em dispositivos móveis, o rodapé do carrinho permanece fixo, permitindo que o cliente consulte os produtos selecionados e acesse a geração do pedido sem precisar percorrer toda a lista.

## 🔐 Segurança

O projeto utiliza variáveis de ambiente para configurações sensíveis.

Arquivos `.env`, dependências locais e arquivos gerados são excluídos do versionamento por meio do `.gitignore`.

O acesso às funcionalidades integradas ao ERP depende das permissões e configurações do ambiente autorizado.

## 📈 Melhorias futuras

- Evolução do painel de gerenciamento de pedidos.
- Acompanhamento do status dos pedidos.
- Aprimoramento da autenticação e do controle de acesso.
- Melhorias de acessibilidade para uso em totens.
- Implementação de testes automatizados.
- Preparação de uma estratégia de implantação em ambiente interno.

## 👨‍💻 Desenvolvedor

**Jean Valente**

GitHub: [@jeanvalente0998](https://github.com/jeanvalente0998)

---

Projeto desenvolvido para estudo, evolução profissional e aplicação prática de tecnologias web integradas a sistemas empresariais.

*O código não inclui credenciais nem dados reais de clientes. A utilização da integração com o ERP requer acesso autorizado.*
