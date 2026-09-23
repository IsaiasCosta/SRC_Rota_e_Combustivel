
(function (app) {
    'use strict';

    document.addEventListener('DOMContentLoaded', async () => {
        const telaLogin = document.getElementById('telaLogin');
        const painel = document.getElementById('painelPrincipal');
        const formulario = document.getElementById('formLogin');
        const statusLogin = document.getElementById('statusLogin');
        const botaoEntrar = document.getElementById('btnEntrar');
        const telaCadastro = document.getElementById('telaCadastro');
        const botaoCriarConta = document.getElementById('btnCriarConta');
        const botaoVoltarLogin = document.getElementById('btnVoltarLogin');
        const statusCadastroUsuario = document.getElementById('statusCadastroUsuario');
        const formularioCadastro = document.getElementById('formCadastroUsuario');
        const botaoCadastrarUsuario = document.getElementById('btnCadastrarUsuario');
        const botaoMostrarSenha = document.getElementById('btnMostrarSenha');
        const campoSenhaLogin = document.getElementById('senhaLogin');
        const botaoEsqueciSenha = document.getElementById('btnEsqueciSenha');
        const botaoLogout = document.getElementById('btnLogout');
        const telaNovaSenha = document.getElementById('telaNovaSenha');
        const formNovaSenha = document.getElementById('formNovaSenha');
        const statusNovaSenha = document.getElementById('statusNovaSenha');
        const botaoSalvarNovaSenha = document.getElementById('btnSalvarNovaSenha');

        let painelInicializado = false;
        botaoCriarConta.addEventListener('click', () => {
            statusLogin.textContent = '';
            statusCadastroUsuario.textContent = '';

            telaLogin.hidden = true;
            telaCadastro.hidden = false;
            painel.hidden = true;
        });

        botaoVoltarLogin.addEventListener('click', () => {
            statusCadastroUsuario.textContent = '';

            telaCadastro.hidden = true;
            telaLogin.hidden = false;
            painel.hidden = true;
        });

        formularioCadastro.addEventListener('submit', async event => {
            event.preventDefault();
            const nome = document.getElementById('nomeCadastro').value.trim();
            const email = document.getElementById('emailCadastro').value.trim();
            const senha = document.getElementById('senhaCadastro').value;
            const confirmacao = document.getElementById('confirmarSenhaCadastro').value;

            if (senha !== confirmacao) {
                statusCadastroUsuario.textContent = 'As senhas não coincidem.';
                return;
            }

            if (senha.length < 12) {
                statusCadastroUsuario.textContent =
                    'A senha deve ter pelo menos 12 caracteres.';
                return;
            }

            botaoCadastrarUsuario.disabled = true;
            statusCadastroUsuario.textContent = 'Criando conta...';

            try {
                await app.services.auth.cadastrar(nome, email, senha);

                formularioCadastro.reset();
                statusCadastroUsuario.textContent =
                    'Solicitação recebida. Verifique seu e-mail para confirmar a conta, se necessário. Depois, volte ao login.';
            } catch (error) {
                statusCadastroUsuario.textContent = error.message;
            } finally {
                botaoCadastrarUsuario.disabled = false;
            }
        });
        if (botaoLogout) {
            botaoLogout.addEventListener('click', () => {
                app.services.auth.sair();
            });
        }
        if (botaoMostrarSenha && campoSenhaLogin) {
            botaoMostrarSenha.addEventListener('click', () => {
                const senhaVisivel = campoSenhaLogin.type === 'text';

                campoSenhaLogin.type = senhaVisivel ? 'password' : 'text';

                botaoMostrarSenha.textContent = senhaVisivel
                    ? 'Mostrar'
                    : 'Ocultar';

                botaoMostrarSenha.setAttribute(
                    'aria-label',
                    senhaVisivel ? 'Mostrar senha' : 'Ocultar senha'
                );

                botaoMostrarSenha.setAttribute(
                    'aria-pressed',
                    String(!senhaVisivel)
                );
            });
        }
        
        const botaoMostrarSenhasCadastro = document.getElementById('btnMostrarSenhaCadastro');
        const campoSenhaCadastro = document.getElementById('senhaCadastro');
        const campoConfirmarSenha = document.getElementById('confirmarSenhaCadastro');

        if (botaoMostrarSenhasCadastro && campoSenhaCadastro && campoConfirmarSenha) {
            botaoMostrarSenhasCadastro.addEventListener('click', () => {
                const senhaVisivel = campoSenhaCadastro.type === 'text';
                const novoTipo = senhaVisivel ? 'password' : 'text';

                campoSenhaCadastro.type = novoTipo;
                campoConfirmarSenha.type = novoTipo;

                botaoMostrarSenhasCadastro.textContent = senhaVisivel ? 'Mostrar' : 'Ocultar';
                botaoMostrarSenhasCadastro.setAttribute(
                    'aria-label',
                    senhaVisivel ? 'Mostrar senhas' : 'Ocultar senhas'
                );
                botaoMostrarSenhasCadastro.setAttribute('aria-pressed', String(!senhaVisivel));
            });
        }
        async function iniciarPainel() {
            if (painelInicializado) return;
            painelInicializado = true;
            const nomeUsuarioLogado = document.getElementById('nomeUsuarioLogado');
            const botaoDefinirNome = document.getElementById('btnDefinirNome');

            function atualizarIdentificacao() {
                const identificacao = app.services.auth.obterNomeUsuario();

                if (nomeUsuarioLogado) {
                    nomeUsuarioLogado.textContent = identificacao;
                }

                if (botaoDefinirNome) {
                    botaoDefinirNome.hidden = app.services.auth.usuarioTemNome();
                }
            }

            atualizarIdentificacao();

            const modalNome = document.getElementById('modalNomeUsuario');
            const formularioNome = document.getElementById('formNomeUsuario');
            const campoNome = document.getElementById('campoNomeUsuario');
            const statusNome = document.getElementById('statusNomeUsuario');
            const botaoCancelarNome = document.getElementById('btnCancelarNome');
            const botaoSalvarNome = document.getElementById('btnSalvarNome');

            if (botaoDefinirNome && modalNome && formularioNome) {
                botaoDefinirNome.addEventListener('click', () => {
                    campoNome.value = '';
                    statusNome.textContent = '';
                    modalNome.showModal();
                    campoNome.focus();
                });

                botaoCancelarNome.addEventListener('click', () => {
                    modalNome.close();
                });

                formularioNome.addEventListener('submit', async event => {
                    event.preventDefault();

                    const nome = campoNome.value.trim();

                    if (!nome) {
                        statusNome.textContent = 'Informe seu nome.';
                        return;
                    }

                    botaoSalvarNome.disabled = true;
                    statusNome.textContent = 'Salvando...';

                    try {
                        await app.services.auth.atualizarNomeUsuario(nome);
                        atualizarIdentificacao();
                        modalNome.close();
                    } catch (error) {
                        statusNome.textContent = error.message;
                    } finally {
                        botaoSalvarNome.disabled = false;
                    }
                });
            }

            const cadastro = app.controllers.cadastro.inicializar();
            app.controllers.roteirizacao.inicializar();
            const importacao = app.controllers.importacao.inicializar();

            const { calcular, alterarCarga } = app.controllers.painel;
            const {
                buscarPostos,
                buscarGPS,
                validarCadastroPostos
            } = app.controllers.localizador;

            app.controllers.painel.restaurarParametros();
            app.ui.medidor.criarMedidor();
            calcular();

            for (const id of app.config.parametros) {
                const campo = document.getElementById(id);
                const evento = campo.tagName === 'SELECT' ? 'change' : 'input';

                campo.addEventListener(
                    evento,
                    id === 'inpCarga' ? alterarCarga : calcular
                );
            }

            const botoesBusca = ['btnBuscarCidade', 'btnGPS']
                .map(id => document.getElementById(id));

            botoesBusca.forEach(botao => {
                botao.disabled = true;
            });

            document.getElementById('quantidadePostos').textContent =
                'Carregando postos...';

            try {
                await app.services.postos.carregar();

                document.getElementById('quantidadePostos').textContent =
                    app.postos.length + ' postos cadastrados';

                validarCadastroPostos();

                botoesBusca.forEach(botao => {
                    botao.disabled = false;
                });

                const administrador =
                    app.services.auth.obterUsuarioId() ===
                    'f2dc8ed7-6063-4c2f-90df-95fd241892d3';

                document.getElementById('importacaoPostos').hidden = !administrador;

                cadastro.definirDisponibilidade(administrador);
                importacao.definirDisponibilidade(administrador);

                try {
                    await app.services.lojas.carregar();
                    app.controllers.roteirizacao.renderizarLojas();

                    const lojasComCoordenadas = app.lojas.filter(
                        app.domain.distancia.coordenadasValidas
                    ).length;

                    const totalLojas = app.lojas.length;

                    const textoLojas = totalLojas === 1
                        ? '1 loja carregada'
                        : `${totalLojas} lojas carregadas`;

                    const textoProntas = lojasComCoordenadas === 1
                        ? '1 pronta'
                        : `${lojasComCoordenadas} prontas`;

                    document.getElementById('statusRoteirizacao').textContent =
                        `${textoLojas}; ${textoProntas} para calcular rota.`;

                } catch (error) {
                    document.getElementById('statusRoteirizacao').textContent =
                        error.message;
                }

            } catch (error) {
                document.getElementById('quantidadePostos').textContent = '';
                document.getElementById('quantidadePostos').hidden = true;

                document.getElementById('statusBusca').textContent =
                    error.message ||
                    'Não foi possível carregar os postos.';

                cadastro.definirDisponibilidade(false);
                importacao.definirDisponibilidade(false);
                return;
            }

            document.getElementById('btnBuscarCidade')
                .addEventListener('click', buscarPostos);

            document.getElementById('btnGPS')
                .addEventListener('click', buscarGPS);

            document.getElementById('inpOrigem')
                .addEventListener('keydown', event => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        buscarPostos();
                    }
                });
        }

        async function mostrarPainel() {
            telaLogin.hidden = true;
            painel.hidden = false;
            await iniciarPainel();
        }
        formNovaSenha.addEventListener('submit', async event => {
            event.preventDefault();

            const senha = document.getElementById('novaSenha').value;
            const confirmacao =
                document.getElementById('confirmarNovaSenha').value;

            if (senha !== confirmacao) {
                statusNovaSenha.textContent = 'As senhas não coincidem.';
                return;
            }

            botaoSalvarNovaSenha.disabled = true;
            statusNovaSenha.textContent = 'Salvando nova senha...';

            try {
                await app.services.auth.definirNovaSenha(senha);

                formNovaSenha.reset();
                telaNovaSenha.hidden = true;
                painel.hidden = true;
                telaLogin.hidden = false;

                statusLogin.textContent =
                    'Senha definida com sucesso. Entre com sua nova senha.';
            } catch (error) {
                statusNovaSenha.textContent = error.message;
            } finally {
                botaoSalvarNovaSenha.disabled = false;
            }
        });
        botaoEsqueciSenha.addEventListener('click', async () => {
            const email = document.getElementById('emailLogin').value.trim();

            if (!email) {
                statusLogin.textContent = 'Informe seu e-mail primeiro.';
                return;
            }

            botaoEsqueciSenha.disabled = true;
            statusLogin.textContent = 'Solicitando recuperação...';

            try {
                await app.services.auth.solicitarRecuperacao(email);

                statusLogin.textContent =
                    'Se o e-mail estiver cadastrado, você receberá um link de recuperação.';
            } catch (error) {
                statusLogin.textContent = error.message;
            } finally {
                botaoEsqueciSenha.disabled = false;
            }
        });

        formulario.addEventListener('submit', async event => {
            event.preventDefault();

            const email = document.getElementById('emailLogin').value.trim();
            const senha = document.getElementById('senhaLogin').value;

            botaoEntrar.disabled = true;
            try {
                const recuperacao = await app.services.auth.processarRecuperacao();

                if (recuperacao) {
                    telaLogin.hidden = true;
                    painel.hidden = true;
                    telaNovaSenha.hidden = false;
                    return;
                }
            } catch (error) {
                telaLogin.hidden = false;
                painel.hidden = true;
                telaNovaSenha.hidden = true;
                statusLogin.textContent = error.message;
                return;
            }

            statusLogin.textContent = 'Verificando acesso...';

            try {
                await app.services.auth.entrar(email, senha);
                statusLogin.textContent = '';
                await mostrarPainel();
            } catch (error) {
                statusLogin.textContent = error.message;
            } finally {
                botaoEntrar.disabled = false;
            }
        });

        statusLogin.textContent = 'Verificando sessão...';

        try {
            const autenticado = await app.services.auth.verificarSessao();

            if (autenticado) {
                statusLogin.textContent = '';
                await mostrarPainel();
            } else {
                telaLogin.hidden = false;
                painel.hidden = true;
                statusLogin.textContent = '';
            }
        } catch {
            telaLogin.hidden = false;
            painel.hidden = true;
            statusLogin.textContent =
                'Não foi possível verificar sua sessão.';
        }
    });
})(window.RotaCombustivel);