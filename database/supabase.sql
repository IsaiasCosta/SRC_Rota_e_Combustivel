CREATE TABLE IF NOT EXISTS postos (
    id BIGSERIAL PRIMARY KEY,
    nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
    nome_mapa TEXT,
    endereco TEXT NOT NULL CHECK (length(trim(endereco)) > 0),
    cidade TEXT NOT NULL CHECK (length(trim(cidade)) > 0),
    estado TEXT NOT NULL CHECK (estado ~ '^[A-Z]{2}$'),
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    cnpj TEXT UNIQUE CHECK (cnpj IS NULL OR (length(cnpj) = 14 AND cnpj ~ '^[0-9]+$')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS postos_estado_cidade ON postos (estado, cidade);

CREATE TABLE IF NOT EXISTS lojas (
    id BIGSERIAL PRIMARY KEY,
    nome TEXT NOT NULL CHECK (length(trim(nome)) > 0),
    marca TEXT,
    endereco TEXT NOT NULL CHECK (length(trim(endereco)) > 0),
    cidade TEXT NOT NULL CHECK (length(trim(cidade)) > 0),
    estado TEXT NOT NULL CHECK (estado ~ '^[A-Z]{2}$'),
    latitude DOUBLE PRECISION CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    link_maps TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS lojas_estado_cidade ON lojas (estado, cidade);
