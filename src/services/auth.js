(function (app) {
    'use strict';

    const CHAVE_SESSAO = 'src_supabase_sessao';
    let sessao = null;

    function configuracao() {
        const { supabaseUrl, supabaseAnonKey } = app.config;

        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error('Configure a URL e a chave pública do Supabase em src/config.js.');
        }

        return { supabaseUrl, supabaseAnonKey };
    }

    function obterToken() {
        return sessao?.access_token || null;
    }
    function obterUsuarioId() {
        return sessao?.user?.id || null;
    }
    function obterNomeUsuario() {
        const usuario = sessao?.user;

        if (!usuario) return '';

        const nome = usuario.user_metadata?.nome_completo;

        if (typeof nome === 'string' && nome.trim()) {
           return nome.trim().split(/[\s_]+/)[0];
        }

        return usuario.email || '';
    }

    function usuarioTemNome() {
        const nome = sessao?.user?.user_metadata?.nome_completo;

        return typeof nome === 'string' && nome.trim().length > 0;
    }

    async function atualizarNomeUsuario(nome) {
        const nomeLimpo = nome.trim();

        if (!nomeLimpo || nomeLimpo.length > 120) {
            throw new Error('Informe um nome de até 120 caracteres.');
        }

        const token = obterToken();

        if (!token) {
            throw new Error('Sessão não encontrada. Entre novamente.');
        }

        const { supabaseUrl, supabaseAnonKey } = configuracao();

        const resposta = await fetch(
            new URL('/auth/v1/user', supabaseUrl),
            {
                method: 'PUT',
                headers: {
                    apikey: supabaseAnonKey,
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    data: {
                        nome_completo: nomeLimpo
                    }
                })
            }
        );

        const usuario = await resposta.json().catch(() => ({}));

        if (!resposta.ok) {
            throw new Error(
                usuario.msg ||
                usuario.error_description ||
                usuario.message ||
                'Não foi possível salvar o nome.'
            );
        }

        sessao.user = usuario;
        salvarSessao(sessao);

        return usuario;
    }

    function salvarSessao(dados) {
        sessao = dados;
        sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(dados));
    }

    function limparSessao() {
        sessao = null;
        sessionStorage.removeItem(CHAVE_SESSAO);
    }

    async function requisicaoAuth(caminho, corpo) {
        const { supabaseUrl, supabaseAnonKey } = configuracao();

        const resposta = await fetch(
            new URL(caminho, supabaseUrl),
            {
                method: 'POST',
                headers: {
                    apikey: supabaseAnonKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(corpo)
            }
        );

        const dados = await resposta.json().catch(() => ({}));

        if (!resposta.ok) {
            throw new Error(
                dados.msg ||
                dados.error_description ||
                dados.message ||
                'Não foi possível autenticar.'
            );
        }

        return dados;
    }

    async function cadastrar(nome,email, senha) {
        return requisicaoAuth(
            '/auth/v1/signup',
            {
                email,
                password: senha,
                data: {
                    nome_completo: nome
                }
            }
        );
    }

    async function entrar(email, senha) {
        const dados = await requisicaoAuth(
            '/auth/v1/token?grant_type=password',
            { email, password: senha }
        );

        salvarSessao(dados);
        return dados;
    }

    async function verificarSessao() {
        const armazenada = sessionStorage.getItem(CHAVE_SESSAO);

        if (!armazenada) return false;

        try {
            const dados = JSON.parse(armazenada);

            if (!dados.refresh_token) {
                limparSessao();
                return false;
            }

            const renovada = await requisicaoAuth(
                '/auth/v1/token?grant_type=refresh_token',
                { refresh_token: dados.refresh_token }
            );

            salvarSessao(renovada);
            return true;
        } catch {
            limparSessao();
            return false;
        }
    }

    function sair() {
        limparSessao();
        window.location.reload();
    }
    async function processarRecuperacao() {
        const fragmento = new URLSearchParams(
            window.location.hash.substring(1)
        );

        const erro = fragmento.get('error_description');

        if (erro) {
            throw new Error(erro);
        }

        if (fragmento.get('type') !== 'recovery') {
            return false;
        }

        const accessToken = fragmento.get('access_token');
        const refreshToken = fragmento.get('refresh_token');

        if (!accessToken || !refreshToken) {
            throw new Error(
                'Link de recuperação incompleto. Solicite um novo link.'
            );
        }

        // A sessão de recuperação é temporária e fica apenas na memória.
        sessao = {
            access_token: accessToken,
            refresh_token: refreshToken
        };

        // Remove os tokens da barra de endereço.
        window.history.replaceState(
            null,
            '',
            window.location.pathname + window.location.search
        );

        return true;
    }

    async function definirNovaSenha(novaSenha) {
        if (!sessao?.access_token) {
            throw new Error('Sessão de recuperação não encontrada.');
        }

        const { supabaseUrl, supabaseAnonKey } = configuracao();

        const resposta = await fetch(
            new URL('/auth/v1/user', supabaseUrl),
            {
                method: 'PUT',
                headers: {
                    apikey: supabaseAnonKey,
                    Authorization: `Bearer ${sessao.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    password: novaSenha
                })
            }
        );

        const dados = await resposta.json().catch(() => ({}));

        if (!resposta.ok) {
            throw new Error(
                dados.msg ||
                dados.error_description ||
                dados.message ||
                'Não foi possível definir a senha.'
            );
        }

        limparSessao();
        return dados;
    }
    async function solicitarRecuperacao(email) {
        const { supabaseUrl, supabaseAnonKey } = configuracao();

        const url = new URL('/auth/v1/recover', supabaseUrl);
        url.searchParams.set('redirect_to', window.location.origin);

        const resposta = await fetch(url, {
            method: 'POST',
            headers: {
                apikey: supabaseAnonKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const dados = await resposta.json().catch(() => ({}));

        if (!resposta.ok) {
            throw new Error(
                dados.msg ||
                dados.error_description ||
                dados.message ||
                'Não foi possível solicitar a recuperação.'
            );
        }

        return dados;
    } app.services.auth = {
        cadastrar,
        entrar,
        obterToken,
        obterUsuarioId,
        obterNomeUsuario,
        usuarioTemNome,
        atualizarNomeUsuario,
        verificarSessao,
        processarRecuperacao,
        definirNovaSenha,
        solicitarRecuperacao,
        sair
    };
})(window.RotaCombustivel); 