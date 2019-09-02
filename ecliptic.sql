--
-- PostgreSQL database dump
--

-- Dumped from database version 9.6.3
-- Dumped by pg_dump version 9.6.3

-- Started on 2017-08-18 18:14:15 EDT

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2287 (class 1262 OID 75234)
-- Name: ecliptic; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE ecliptic WITH TEMPLATE = template0 ENCODING = 'UTF8' LC_COLLATE = 'en_US.UTF-8' LC_CTYPE = 'en_US.UTF-8';


ALTER DATABASE ecliptic OWNER TO postgres;

\connect ecliptic

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 6 (class 2615 OID 75235)
-- Name: auth; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA auth;


ALTER SCHEMA auth OWNER TO postgres;

--
-- TOC entry 7 (class 2615 OID 108241)
-- Name: esp; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA esp;


ALTER SCHEMA esp OWNER TO postgres;

--
-- TOC entry 4 (class 2615 OID 125091)
-- Name: teller; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA teller;


ALTER SCHEMA teller OWNER TO postgres;

--
-- TOC entry 11 (class 2615 OID 125050)
-- Name: teller2; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA teller2;


ALTER SCHEMA teller2 OWNER TO postgres;

--
-- TOC entry 12 (class 2615 OID 125070)
-- Name: teller3; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA teller3;


ALTER SCHEMA teller3 OWNER TO postgres;

--
-- TOC entry 1 (class 3079 OID 12433)
-- Name: plpgsql; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;


--
-- TOC entry 2289 (class 0 OID 0)
-- Dependencies: 1
-- Name: EXTENSION plpgsql; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION plpgsql IS 'PL/pgSQL procedural language';


SET search_path = auth, pg_catalog;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- TOC entry 190 (class 1259 OID 75239)
-- Name: candidate; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE candidate (
    eid integer NOT NULL,
    cid integer NOT NULL,
    name character varying(255),
    create_time timestamp without time zone DEFAULT now(),
    update_time timestamp without time zone DEFAULT now()
);


ALTER TABLE candidate OWNER TO postgres;

--
-- TOC entry 2290 (class 0 OID 0)
-- Dependencies: 190
-- Name: COLUMN candidate.eid; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN candidate.eid IS 'election id';


--
-- TOC entry 2291 (class 0 OID 0)
-- Dependencies: 190
-- Name: COLUMN candidate.cid; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN candidate.cid IS 'candidate id for current election';


--
-- TOC entry 2292 (class 0 OID 0)
-- Dependencies: 190
-- Name: COLUMN candidate.name; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN candidate.name IS 'candidate name';


--
-- TOC entry 191 (class 1259 OID 75244)
-- Name: elec_position; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE elec_position (
    eid integer NOT NULL,
    pid integer NOT NULL,
    name character varying(255),
    create_time timestamp without time zone DEFAULT now(),
    update_time timestamp without time zone DEFAULT now()
);


ALTER TABLE elec_position OWNER TO postgres;

--
-- TOC entry 2293 (class 0 OID 0)
-- Dependencies: 191
-- Name: COLUMN elec_position.eid; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN elec_position.eid IS 'election id';


--
-- TOC entry 2294 (class 0 OID 0)
-- Dependencies: 191
-- Name: COLUMN elec_position.pid; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN elec_position.pid IS 'election position id';


--
-- TOC entry 2295 (class 0 OID 0)
-- Dependencies: 191
-- Name: COLUMN elec_position.name; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN elec_position.name IS 'position name';


--
-- TOC entry 194 (class 1259 OID 124971)
-- Name: election; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE election (
    id integer NOT NULL,
    name character varying(255),
    state integer,
    create_time timestamp without time zone DEFAULT now(),
    update_time timestamp without time zone DEFAULT now(),
    is_verified boolean DEFAULT false NOT NULL,
    verify_result boolean DEFAULT false NOT NULL,
    tunnel_port integer,
    esp_pub_key character varying,
    freeze_time timestamp without time zone,
    freeze_sign character varying,
    voter_count integer DEFAULT 0,
    is_voter_sign boolean DEFAULT false NOT NULL,
    voter_sign character varying,
    is_teller_sign boolean DEFAULT false NOT NULL,
    teller_sign character varying,
    open_time timestamp without time zone,
    open_sign character varying,
    close_time timestamp without time zone,
    close_sign character varying
);


ALTER TABLE election OWNER TO postgres;

--
-- TOC entry 2296 (class 0 OID 0)
-- Dependencies: 194
-- Name: COLUMN election.id; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN election.id IS 'election id';


--
-- TOC entry 2297 (class 0 OID 0)
-- Dependencies: 194
-- Name: COLUMN election.name; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN election.name IS 'election name';


--
-- TOC entry 2298 (class 0 OID 0)
-- Dependencies: 194
-- Name: COLUMN election.state; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN election.state IS 'current state (0-4)';


--
-- TOC entry 2299 (class 0 OID 0)
-- Dependencies: 194
-- Name: COLUMN election.create_time; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN election.create_time IS 'creation timestamp';


--
-- TOC entry 2300 (class 0 OID 0)
-- Dependencies: 194
-- Name: COLUMN election.update_time; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN election.update_time IS 'last update timestamp';


--
-- TOC entry 2301 (class 0 OID 0)
-- Dependencies: 194
-- Name: COLUMN election.tunnel_port; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN election.tunnel_port IS 'a port on authority for tunnelling';


--
-- TOC entry 192 (class 1259 OID 75261)
-- Name: position_candidate_map; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE position_candidate_map (
    eid integer NOT NULL,
    pid integer NOT NULL,
    cid integer NOT NULL
);


ALTER TABLE position_candidate_map OWNER TO postgres;

--
-- TOC entry 2302 (class 0 OID 0)
-- Dependencies: 192
-- Name: COLUMN position_candidate_map.eid; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN position_candidate_map.eid IS 'election id';


--
-- TOC entry 2303 (class 0 OID 0)
-- Dependencies: 192
-- Name: COLUMN position_candidate_map.pid; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN position_candidate_map.pid IS 'position id';


--
-- TOC entry 2304 (class 0 OID 0)
-- Dependencies: 192
-- Name: COLUMN position_candidate_map.cid; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN position_candidate_map.cid IS 'candidate id';


--
-- TOC entry 196 (class 1259 OID 125015)
-- Name: teller; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE teller (
    eid integer NOT NULL,
    hostname character varying(255) NOT NULL,
    port integer NOT NULL,
    protocol character varying(5),
    tunnel_port integer,
    pub_key character varying,
    reg_time timestamp without time zone DEFAULT now(),
    count jsonb,
    count_time timestamp without time zone,
    count_sign character varying
);


ALTER TABLE teller OWNER TO postgres;

--
-- TOC entry 2305 (class 0 OID 0)
-- Dependencies: 196
-- Name: COLUMN teller.eid; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN teller.eid IS 'election id';


--
-- TOC entry 2306 (class 0 OID 0)
-- Dependencies: 196
-- Name: COLUMN teller.hostname; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN teller.hostname IS 'teller server domain';


--
-- TOC entry 2307 (class 0 OID 0)
-- Dependencies: 196
-- Name: COLUMN teller.tunnel_port; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN teller.tunnel_port IS 'a port on each teller for tunnelling';


--
-- TOC entry 2308 (class 0 OID 0)
-- Dependencies: 196
-- Name: COLUMN teller.pub_key; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN teller.pub_key IS 'teller public key';


--
-- TOC entry 2309 (class 0 OID 0)
-- Dependencies: 196
-- Name: COLUMN teller.reg_time; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN teller.reg_time IS 'teller registration timestamp';


--
-- TOC entry 195 (class 1259 OID 125005)
-- Name: voter; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE voter (
    eid integer NOT NULL,
    identifier character varying(255) NOT NULL,
    rid character varying,
    reg_time timestamp without time zone,
    link_time timestamp without time zone,
    link_sign character varying
);


ALTER TABLE voter OWNER TO postgres;

--
-- TOC entry 2310 (class 0 OID 0)
-- Dependencies: 195
-- Name: COLUMN voter.eid; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN voter.eid IS 'election id';


--
-- TOC entry 2311 (class 0 OID 0)
-- Dependencies: 195
-- Name: COLUMN voter.identifier; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN voter.identifier IS 'voter identifier, use email right now';


--
-- TOC entry 2312 (class 0 OID 0)
-- Dependencies: 195
-- Name: COLUMN voter.rid; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN voter.rid IS 'random voting id';


--
-- TOC entry 2313 (class 0 OID 0)
-- Dependencies: 195
-- Name: COLUMN voter.reg_time; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN voter.reg_time IS 'registration time';


--
-- TOC entry 2314 (class 0 OID 0)
-- Dependencies: 195
-- Name: COLUMN voter.link_time; Type: COMMENT; Schema: auth; Owner: postgres
--

COMMENT ON COLUMN voter.link_time IS 'actual voting time stamp';


SET search_path = esp, pg_catalog;

--
-- TOC entry 198 (class 1259 OID 125027)
-- Name: election; Type: TABLE; Schema: esp; Owner: postgres
--

CREATE TABLE election (
    id integer NOT NULL,
    auth_hostname character varying,
    auth_protocol character varying,
    auth_port integer,
    tunnel_port integer,
    state integer,
    election_data jsonb,
    auth_pub_key character varying,
    summation jsonb
);


ALTER TABLE election OWNER TO postgres;

--
-- TOC entry 2315 (class 0 OID 0)
-- Dependencies: 198
-- Name: COLUMN election.state; Type: COMMENT; Schema: esp; Owner: postgres
--

COMMENT ON COLUMN election.state IS 'current state (0-3)';


--
-- TOC entry 197 (class 1259 OID 125025)
-- Name: election_id_seq; Type: SEQUENCE; Schema: esp; Owner: postgres
--

CREATE SEQUENCE election_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE election_id_seq OWNER TO postgres;

--
-- TOC entry 2316 (class 0 OID 0)
-- Dependencies: 197
-- Name: election_id_seq; Type: SEQUENCE OWNED BY; Schema: esp; Owner: postgres
--

ALTER SEQUENCE election_id_seq OWNED BY election.id;


--
-- TOC entry 193 (class 1259 OID 116654)
-- Name: votes; Type: TABLE; Schema: esp; Owner: postgres
--

CREATE TABLE votes (
    eid integer NOT NULL,
    rid character varying NOT NULL,
    email character varying NOT NULL,
    reg_time timestamp without time zone NOT NULL,
    link_time timestamp without time zone NOT NULL,
    link_sign character varying NOT NULL,
    data jsonb,
    vote_time timestamp without time zone DEFAULT now(),
    vote_sign character varying NOT NULL
);


ALTER TABLE votes OWNER TO postgres;

--
-- TOC entry 2317 (class 0 OID 0)
-- Dependencies: 193
-- Name: COLUMN votes.eid; Type: COMMENT; Schema: esp; Owner: postgres
--

COMMENT ON COLUMN votes.eid IS 'election id';


--
-- TOC entry 2318 (class 0 OID 0)
-- Dependencies: 193
-- Name: COLUMN votes.rid; Type: COMMENT; Schema: esp; Owner: postgres
--

COMMENT ON COLUMN votes.rid IS 'voter id';


--
-- TOC entry 2319 (class 0 OID 0)
-- Dependencies: 193
-- Name: COLUMN votes.email; Type: COMMENT; Schema: esp; Owner: postgres
--

COMMENT ON COLUMN votes.email IS 'voter email';


--
-- TOC entry 2320 (class 0 OID 0)
-- Dependencies: 193
-- Name: COLUMN votes.reg_time; Type: COMMENT; Schema: esp; Owner: postgres
--

COMMENT ON COLUMN votes.reg_time IS 'voter reg time';


--
-- TOC entry 2321 (class 0 OID 0)
-- Dependencies: 193
-- Name: COLUMN votes.link_time; Type: COMMENT; Schema: esp; Owner: postgres
--

COMMENT ON COLUMN votes.link_time IS 'voter id';


--
-- TOC entry 2322 (class 0 OID 0)
-- Dependencies: 193
-- Name: COLUMN votes.link_sign; Type: COMMENT; Schema: esp; Owner: postgres
--

COMMENT ON COLUMN votes.link_sign IS 'voter link sign';


--
-- TOC entry 2323 (class 0 OID 0)
-- Dependencies: 193
-- Name: COLUMN votes.vote_time; Type: COMMENT; Schema: esp; Owner: postgres
--

COMMENT ON COLUMN votes.vote_time IS 'vote time stamp';


SET search_path = teller, pg_catalog;

--
-- TOC entry 203 (class 1259 OID 125092)
-- Name: election; Type: TABLE; Schema: teller; Owner: postgres
--

CREATE TABLE election (
    id integer NOT NULL,
    election_data jsonb,
    esp_pub_key character varying,
    auth_pub_key character varying,
    esp_url jsonb,
    auth_url jsonb,
    reg_time timestamp without time zone DEFAULT now() NOT NULL,
    count jsonb,
    count_time timestamp without time zone,
    count_sign character varying
);


ALTER TABLE election OWNER TO postgres;

--
-- TOC entry 2324 (class 0 OID 0)
-- Dependencies: 203
-- Name: COLUMN election.id; Type: COMMENT; Schema: teller; Owner: postgres
--

COMMENT ON COLUMN election.id IS 'election id';


--
-- TOC entry 2325 (class 0 OID 0)
-- Dependencies: 203
-- Name: COLUMN election.election_data; Type: COMMENT; Schema: teller; Owner: postgres
--

COMMENT ON COLUMN election.election_data IS 'election data';


--
-- TOC entry 2326 (class 0 OID 0)
-- Dependencies: 203
-- Name: COLUMN election.esp_pub_key; Type: COMMENT; Schema: teller; Owner: postgres
--

COMMENT ON COLUMN election.esp_pub_key IS 'public key';


--
-- TOC entry 2327 (class 0 OID 0)
-- Dependencies: 203
-- Name: COLUMN election.reg_time; Type: COMMENT; Schema: teller; Owner: postgres
--

COMMENT ON COLUMN election.reg_time IS 'teller server registration time for current election';


--
-- TOC entry 204 (class 1259 OID 125101)
-- Name: votes; Type: TABLE; Schema: teller; Owner: postgres
--

CREATE TABLE votes (
    eid integer NOT NULL,
    rid character varying NOT NULL,
    email character varying NOT NULL,
    reg_time timestamp without time zone NOT NULL,
    link_time timestamp without time zone NOT NULL,
    link_sign character varying NOT NULL,
    data bytea,
    vote_time timestamp without time zone DEFAULT now(),
    vote_sign character varying NOT NULL,
    receipt_time timestamp without time zone,
    receipt_sign character varying,
    is_sum boolean DEFAULT false
);


ALTER TABLE votes OWNER TO postgres;

--
-- TOC entry 2328 (class 0 OID 0)
-- Dependencies: 204
-- Name: COLUMN votes.eid; Type: COMMENT; Schema: teller; Owner: postgres
--

COMMENT ON COLUMN votes.eid IS 'election id';


--
-- TOC entry 2329 (class 0 OID 0)
-- Dependencies: 204
-- Name: COLUMN votes.rid; Type: COMMENT; Schema: teller; Owner: postgres
--

COMMENT ON COLUMN votes.rid IS 'voter id';


--
-- TOC entry 2330 (class 0 OID 0)
-- Dependencies: 204
-- Name: COLUMN votes.email; Type: COMMENT; Schema: teller; Owner: postgres
--

COMMENT ON COLUMN votes.email IS 'voter email';


--
-- TOC entry 2331 (class 0 OID 0)
-- Dependencies: 204
-- Name: COLUMN votes.reg_time; Type: COMMENT; Schema: teller; Owner: postgres
--

COMMENT ON COLUMN votes.reg_time IS 'voter reg time';


--
-- TOC entry 2332 (class 0 OID 0)
-- Dependencies: 204
-- Name: COLUMN votes.link_time; Type: COMMENT; Schema: teller; Owner: postgres
--

COMMENT ON COLUMN votes.link_time IS 'voter id';


--
-- TOC entry 2333 (class 0 OID 0)
-- Dependencies: 204
-- Name: COLUMN votes.link_sign; Type: COMMENT; Schema: teller; Owner: postgres
--

COMMENT ON COLUMN votes.link_sign IS 'voter link sign';


--
-- TOC entry 2334 (class 0 OID 0)
-- Dependencies: 204
-- Name: COLUMN votes.data; Type: COMMENT; Schema: teller; Owner: postgres
--

COMMENT ON COLUMN votes.data IS '[{x:x_i1, y: y_i1, z: z_i1}, ...]';


--
-- TOC entry 2335 (class 0 OID 0)
-- Dependencies: 204
-- Name: COLUMN votes.vote_time; Type: COMMENT; Schema: teller; Owner: postgres
--

COMMENT ON COLUMN votes.vote_time IS 'vote time stamp';


SET search_path = teller2, pg_catalog;

--
-- TOC entry 199 (class 1259 OID 125051)
-- Name: election; Type: TABLE; Schema: teller2; Owner: postgres
--

CREATE TABLE election (
    id integer NOT NULL,
    election_data jsonb,
    esp_pub_key character varying,
    auth_pub_key character varying,
    esp_url jsonb,
    auth_url jsonb,
    reg_time timestamp without time zone DEFAULT now() NOT NULL,
    count jsonb,
    count_time timestamp without time zone,
    count_sign character varying
);


ALTER TABLE election OWNER TO postgres;

--
-- TOC entry 2336 (class 0 OID 0)
-- Dependencies: 199
-- Name: COLUMN election.id; Type: COMMENT; Schema: teller2; Owner: postgres
--

COMMENT ON COLUMN election.id IS 'election id';


--
-- TOC entry 2337 (class 0 OID 0)
-- Dependencies: 199
-- Name: COLUMN election.election_data; Type: COMMENT; Schema: teller2; Owner: postgres
--

COMMENT ON COLUMN election.election_data IS 'election data';


--
-- TOC entry 2338 (class 0 OID 0)
-- Dependencies: 199
-- Name: COLUMN election.esp_pub_key; Type: COMMENT; Schema: teller2; Owner: postgres
--

COMMENT ON COLUMN election.esp_pub_key IS 'public key';


--
-- TOC entry 2339 (class 0 OID 0)
-- Dependencies: 199
-- Name: COLUMN election.reg_time; Type: COMMENT; Schema: teller2; Owner: postgres
--

COMMENT ON COLUMN election.reg_time IS 'teller server registration time for current election';


--
-- TOC entry 200 (class 1259 OID 125060)
-- Name: votes; Type: TABLE; Schema: teller2; Owner: postgres
--

CREATE TABLE votes (
    eid integer NOT NULL,
    rid character varying NOT NULL,
    email character varying NOT NULL,
    reg_time timestamp without time zone NOT NULL,
    link_time timestamp without time zone NOT NULL,
    link_sign character varying NOT NULL,
    data bytea,
    vote_time timestamp without time zone DEFAULT now(),
    vote_sign character varying NOT NULL,
    receipt_time timestamp without time zone,
    receipt_sign character varying,
    is_sum boolean DEFAULT false
);


ALTER TABLE votes OWNER TO postgres;

--
-- TOC entry 2340 (class 0 OID 0)
-- Dependencies: 200
-- Name: COLUMN votes.eid; Type: COMMENT; Schema: teller2; Owner: postgres
--

COMMENT ON COLUMN votes.eid IS 'election id';


--
-- TOC entry 2341 (class 0 OID 0)
-- Dependencies: 200
-- Name: COLUMN votes.rid; Type: COMMENT; Schema: teller2; Owner: postgres
--

COMMENT ON COLUMN votes.rid IS 'voter id';


--
-- TOC entry 2342 (class 0 OID 0)
-- Dependencies: 200
-- Name: COLUMN votes.email; Type: COMMENT; Schema: teller2; Owner: postgres
--

COMMENT ON COLUMN votes.email IS 'voter email';


--
-- TOC entry 2343 (class 0 OID 0)
-- Dependencies: 200
-- Name: COLUMN votes.reg_time; Type: COMMENT; Schema: teller2; Owner: postgres
--

COMMENT ON COLUMN votes.reg_time IS 'voter reg time';


--
-- TOC entry 2344 (class 0 OID 0)
-- Dependencies: 200
-- Name: COLUMN votes.link_time; Type: COMMENT; Schema: teller2; Owner: postgres
--

COMMENT ON COLUMN votes.link_time IS 'voter id';


--
-- TOC entry 2345 (class 0 OID 0)
-- Dependencies: 200
-- Name: COLUMN votes.link_sign; Type: COMMENT; Schema: teller2; Owner: postgres
--

COMMENT ON COLUMN votes.link_sign IS 'voter link sign';


--
-- TOC entry 2346 (class 0 OID 0)
-- Dependencies: 200
-- Name: COLUMN votes.data; Type: COMMENT; Schema: teller2; Owner: postgres
--

COMMENT ON COLUMN votes.data IS '[{x:x_i1, y: y_i1, z: z_i1}, ...]';


--
-- TOC entry 2347 (class 0 OID 0)
-- Dependencies: 200
-- Name: COLUMN votes.vote_time; Type: COMMENT; Schema: teller2; Owner: postgres
--

COMMENT ON COLUMN votes.vote_time IS 'vote time stamp';


SET search_path = teller3, pg_catalog;

--
-- TOC entry 201 (class 1259 OID 125071)
-- Name: election; Type: TABLE; Schema: teller3; Owner: postgres
--

CREATE TABLE election (
    id integer NOT NULL,
    election_data jsonb,
    esp_pub_key character varying,
    auth_pub_key character varying,
    esp_url jsonb,
    auth_url jsonb,
    reg_time timestamp without time zone DEFAULT now() NOT NULL,
    count jsonb,
    count_time timestamp without time zone,
    count_sign character varying
);


ALTER TABLE election OWNER TO postgres;

--
-- TOC entry 2348 (class 0 OID 0)
-- Dependencies: 201
-- Name: COLUMN election.id; Type: COMMENT; Schema: teller3; Owner: postgres
--

COMMENT ON COLUMN election.id IS 'election id';


--
-- TOC entry 2349 (class 0 OID 0)
-- Dependencies: 201
-- Name: COLUMN election.election_data; Type: COMMENT; Schema: teller3; Owner: postgres
--

COMMENT ON COLUMN election.election_data IS 'election data';


--
-- TOC entry 2350 (class 0 OID 0)
-- Dependencies: 201
-- Name: COLUMN election.esp_pub_key; Type: COMMENT; Schema: teller3; Owner: postgres
--

COMMENT ON COLUMN election.esp_pub_key IS 'public key';


--
-- TOC entry 2351 (class 0 OID 0)
-- Dependencies: 201
-- Name: COLUMN election.reg_time; Type: COMMENT; Schema: teller3; Owner: postgres
--

COMMENT ON COLUMN election.reg_time IS 'teller server registration time for current election';


--
-- TOC entry 202 (class 1259 OID 125080)
-- Name: votes; Type: TABLE; Schema: teller3; Owner: postgres
--

CREATE TABLE votes (
    eid integer NOT NULL,
    rid character varying NOT NULL,
    email character varying NOT NULL,
    reg_time timestamp without time zone NOT NULL,
    link_time timestamp without time zone NOT NULL,
    link_sign character varying NOT NULL,
    data bytea,
    vote_time timestamp without time zone DEFAULT now(),
    vote_sign character varying NOT NULL,
    receipt_time timestamp without time zone,
    receipt_sign character varying,
    is_sum boolean DEFAULT false
);


ALTER TABLE votes OWNER TO postgres;

--
-- TOC entry 2352 (class 0 OID 0)
-- Dependencies: 202
-- Name: COLUMN votes.eid; Type: COMMENT; Schema: teller3; Owner: postgres
--

COMMENT ON COLUMN votes.eid IS 'election id';


--
-- TOC entry 2353 (class 0 OID 0)
-- Dependencies: 202
-- Name: COLUMN votes.rid; Type: COMMENT; Schema: teller3; Owner: postgres
--

COMMENT ON COLUMN votes.rid IS 'voter id';


--
-- TOC entry 2354 (class 0 OID 0)
-- Dependencies: 202
-- Name: COLUMN votes.email; Type: COMMENT; Schema: teller3; Owner: postgres
--

COMMENT ON COLUMN votes.email IS 'voter email';


--
-- TOC entry 2355 (class 0 OID 0)
-- Dependencies: 202
-- Name: COLUMN votes.reg_time; Type: COMMENT; Schema: teller3; Owner: postgres
--

COMMENT ON COLUMN votes.reg_time IS 'voter reg time';


--
-- TOC entry 2356 (class 0 OID 0)
-- Dependencies: 202
-- Name: COLUMN votes.link_time; Type: COMMENT; Schema: teller3; Owner: postgres
--

COMMENT ON COLUMN votes.link_time IS 'voter id';


--
-- TOC entry 2357 (class 0 OID 0)
-- Dependencies: 202
-- Name: COLUMN votes.link_sign; Type: COMMENT; Schema: teller3; Owner: postgres
--

COMMENT ON COLUMN votes.link_sign IS 'voter link sign';


--
-- TOC entry 2358 (class 0 OID 0)
-- Dependencies: 202
-- Name: COLUMN votes.data; Type: COMMENT; Schema: teller3; Owner: postgres
--

COMMENT ON COLUMN votes.data IS '[{x:x_i1, y: y_i1, z: z_i1}, ...]';


--
-- TOC entry 2359 (class 0 OID 0)
-- Dependencies: 202
-- Name: COLUMN votes.vote_time; Type: COMMENT; Schema: teller3; Owner: postgres
--

COMMENT ON COLUMN votes.vote_time IS 'vote time stamp';


SET search_path = esp, pg_catalog;

--
-- TOC entry 2126 (class 2604 OID 125030)
-- Name: election id; Type: DEFAULT; Schema: esp; Owner: postgres
--

ALTER TABLE ONLY election ALTER COLUMN id SET DEFAULT nextval('election_id_seq'::regclass);


SET search_path = auth, pg_catalog;

--
-- TOC entry 2137 (class 2606 OID 75328)
-- Name: candidate candidate_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY candidate
    ADD CONSTRAINT candidate_pkey PRIMARY KEY (eid, cid);


--
-- TOC entry 2139 (class 2606 OID 75330)
-- Name: elec_position elec_position_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY elec_position
    ADD CONSTRAINT elec_position_pkey PRIMARY KEY (eid, pid);


--
-- TOC entry 2145 (class 2606 OID 124985)
-- Name: election election_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY election
    ADD CONSTRAINT election_pkey PRIMARY KEY (id);


--
-- TOC entry 2141 (class 2606 OID 75334)
-- Name: position_candidate_map position_candidate_map_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY position_candidate_map
    ADD CONSTRAINT position_candidate_map_pkey PRIMARY KEY (eid, pid, cid);


--
-- TOC entry 2151 (class 2606 OID 125023)
-- Name: teller teller_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY teller
    ADD CONSTRAINT teller_pkey PRIMARY KEY (eid, hostname, port);


--
-- TOC entry 2147 (class 2606 OID 125014)
-- Name: voter voter_eid_rid_key; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY voter
    ADD CONSTRAINT voter_eid_rid_key UNIQUE (eid, rid);


--
-- TOC entry 2149 (class 2606 OID 125012)
-- Name: voter voter_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY voter
    ADD CONSTRAINT voter_pkey PRIMARY KEY (eid, identifier);


SET search_path = esp, pg_catalog;

--
-- TOC entry 2153 (class 2606 OID 125035)
-- Name: election election_pkey; Type: CONSTRAINT; Schema: esp; Owner: postgres
--

ALTER TABLE ONLY election
    ADD CONSTRAINT election_pkey PRIMARY KEY (id);


--
-- TOC entry 2143 (class 2606 OID 116662)
-- Name: votes votes_pkey; Type: CONSTRAINT; Schema: esp; Owner: postgres
--

ALTER TABLE ONLY votes
    ADD CONSTRAINT votes_pkey PRIMARY KEY (eid, rid);


SET search_path = teller, pg_catalog;

--
-- TOC entry 2163 (class 2606 OID 125100)
-- Name: election election_pkey; Type: CONSTRAINT; Schema: teller; Owner: postgres
--

ALTER TABLE ONLY election
    ADD CONSTRAINT election_pkey PRIMARY KEY (id);


--
-- TOC entry 2165 (class 2606 OID 125110)
-- Name: votes votes_pkey; Type: CONSTRAINT; Schema: teller; Owner: postgres
--

ALTER TABLE ONLY votes
    ADD CONSTRAINT votes_pkey PRIMARY KEY (eid, rid, vote_sign);


SET search_path = teller2, pg_catalog;

--
-- TOC entry 2155 (class 2606 OID 125059)
-- Name: election election_pkey; Type: CONSTRAINT; Schema: teller2; Owner: postgres
--

ALTER TABLE ONLY election
    ADD CONSTRAINT election_pkey PRIMARY KEY (id);


--
-- TOC entry 2157 (class 2606 OID 125069)
-- Name: votes votes_pkey; Type: CONSTRAINT; Schema: teller2; Owner: postgres
--

ALTER TABLE ONLY votes
    ADD CONSTRAINT votes_pkey PRIMARY KEY (eid, rid, vote_sign);


SET search_path = teller3, pg_catalog;

--
-- TOC entry 2159 (class 2606 OID 125079)
-- Name: election election_pkey; Type: CONSTRAINT; Schema: teller3; Owner: postgres
--

ALTER TABLE ONLY election
    ADD CONSTRAINT election_pkey PRIMARY KEY (id);


--
-- TOC entry 2161 (class 2606 OID 125089)
-- Name: votes votes_pkey; Type: CONSTRAINT; Schema: teller3; Owner: postgres
--

ALTER TABLE ONLY votes
    ADD CONSTRAINT votes_pkey PRIMARY KEY (eid, rid, vote_sign);


-- Completed on 2017-08-18 18:14:15 EDT

--
-- PostgreSQL database dump complete
--

