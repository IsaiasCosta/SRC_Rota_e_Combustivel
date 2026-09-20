
(function (app) {
    'use strict';

    document.addEventListener('DOMContentLoaded', async () => {
        const telaLogin = document.getElementById('telaLogin');
        const painel = document.getElementById('painelPrincipal');
        const formulario = document.getElementById('formLogin');
        const statusLogin = document.getElementById('statusLogin');
        const botaoEntrar = document.getElementById('btnEntrar');
        const botaoMostrarSenha = document.getElementById('btnMostrarSenha');
        const campoSenhaLogin = document.getElementById('senhaLogin');
        const botaoEsqueciSenha = document.getElementById('btnEsqueciSenha');
        const botaoLogout = document.getElementById('btnLogout');
        const telaNovaSenha = document.getElementById('telaNovaSenha');
        const formNovaSenha = document.getElementById('formNovaSenha');
        const statusNovaSenha = document.getElementById('statusNovaSenha');
        const botaoSalvarNovaSenha = document.getElementById('btnSalvarNovaSenha');

        let painelInicializado = false;
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

        async function iniciarPainel() {
            if (painelInicializado) return;
            painelInicializado = true;

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

                cadastro.definirDisponibilidade(true);
                importacao.definirDisponibilidade(true);

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