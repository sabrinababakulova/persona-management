--
-- PostgreSQL database dump
--

\restrict oMVgdMmz6eh8mbZJku9HFq8ceAWjFTPOeisioihI5xLI3xBlYpqxZA6cv4D3bJg

-- Dumped from database version 18.3 (Debian 18.3-1.pgdg13+1)
-- Dumped by pg_dump version 18.3 (Debian 18.3-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.account (
    "userId" character varying(255) NOT NULL,
    type character varying(255) NOT NULL,
    provider character varying(255) NOT NULL,
    "providerAccountId" character varying(255) NOT NULL,
    refresh_token text,
    access_token text,
    expires_at integer,
    token_type character varying(255),
    scope character varying(255),
    id_token text,
    session_state character varying(255)
);


ALTER TABLE public.account OWNER TO postgres;

--
-- Name: candidate; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate (
    id character varying(255) NOT NULL,
    "fullName" character varying(255) NOT NULL,
    city character varying(255),
    "salaryExpectation" integer,
    "salaryCurrency" character varying(10) DEFAULT 'UZS'::character varying,
    "currentPosition" character varying(255),
    source character varying(255),
    status character varying(50) DEFAULT 'new'::character varying,
    "resumeUrl" character varying(500),
    "resumeFileName" character varying(255),
    "resumeFileSize" character varying(50),
    experience character varying(255),
    "matchScore" integer,
    "aiAnalysis" text,
    contacts json DEFAULT '[]'::json,
    skills json DEFAULT '[]'::json,
    languages json DEFAULT '[]'::json,
    tags json DEFAULT '[]'::json,
    "workExperience" json DEFAULT '[]'::json,
    education json DEFAULT '[]'::json,
    notes json DEFAULT '[]'::json,
    activities json DEFAULT '[]'::json,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone
);


ALTER TABLE public.candidate OWNER TO postgres;

--
-- Name: candidate_contact_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_contact_type (
    value character varying(50) NOT NULL,
    label character varying(255) NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


ALTER TABLE public.candidate_contact_type OWNER TO postgres;

--
-- Name: candidate_language; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_language (
    value character varying(50) NOT NULL,
    label character varying(255) NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


ALTER TABLE public.candidate_language OWNER TO postgres;

--
-- Name: candidate_language_level; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_language_level (
    value character varying(10) NOT NULL,
    label character varying(255) NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


ALTER TABLE public.candidate_language_level OWNER TO postgres;

--
-- Name: candidate_position; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_position (
    value character varying(100) NOT NULL,
    label character varying(255) NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


ALTER TABLE public.candidate_position OWNER TO postgres;

--
-- Name: candidate_skill; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_skill (
    value character varying(255) NOT NULL,
    label character varying(255) NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


ALTER TABLE public.candidate_skill OWNER TO postgres;

--
-- Name: candidate_source; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_source (
    value character varying(100) NOT NULL,
    label character varying(255) NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


ALTER TABLE public.candidate_source OWNER TO postgres;

--
-- Name: candidate_status_option; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_status_option (
    value character varying(50) NOT NULL,
    label character varying(255) NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


ALTER TABLE public.candidate_status_option OWNER TO postgres;

--
-- Name: directus_access; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_access (
    id uuid NOT NULL,
    role uuid,
    "user" uuid,
    policy uuid NOT NULL,
    sort integer
);


ALTER TABLE public.directus_access OWNER TO postgres;

--
-- Name: directus_activity; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_activity (
    id integer NOT NULL,
    action character varying(45) NOT NULL,
    "user" uuid,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ip character varying(50),
    user_agent text,
    collection character varying(64) NOT NULL,
    item character varying(255) NOT NULL,
    origin character varying(255)
);


ALTER TABLE public.directus_activity OWNER TO postgres;

--
-- Name: directus_activity_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.directus_activity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.directus_activity_id_seq OWNER TO postgres;

--
-- Name: directus_activity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.directus_activity_id_seq OWNED BY public.directus_activity.id;


--
-- Name: directus_collections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_collections (
    collection character varying(64) NOT NULL,
    icon character varying(64),
    note text,
    display_template character varying(255),
    hidden boolean DEFAULT false NOT NULL,
    singleton boolean DEFAULT false NOT NULL,
    translations json,
    archive_field character varying(64),
    archive_app_filter boolean DEFAULT true NOT NULL,
    archive_value character varying(255),
    unarchive_value character varying(255),
    sort_field character varying(64),
    accountability character varying(255) DEFAULT 'all'::character varying,
    color character varying(255),
    item_duplication_fields json,
    sort integer,
    "group" character varying(64),
    collapse character varying(255) DEFAULT 'open'::character varying NOT NULL,
    preview_url character varying(255),
    versioning boolean DEFAULT false NOT NULL
);


ALTER TABLE public.directus_collections OWNER TO postgres;

--
-- Name: directus_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_comments (
    id uuid NOT NULL,
    collection character varying(64) NOT NULL,
    item character varying(255) NOT NULL,
    comment text NOT NULL,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    date_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_created uuid,
    user_updated uuid
);


ALTER TABLE public.directus_comments OWNER TO postgres;

--
-- Name: directus_dashboards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_dashboards (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    icon character varying(64) DEFAULT 'dashboard'::character varying NOT NULL,
    note text,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_created uuid,
    color character varying(255)
);


ALTER TABLE public.directus_dashboards OWNER TO postgres;

--
-- Name: directus_deployment_projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_deployment_projects (
    id uuid NOT NULL,
    deployment uuid NOT NULL,
    external_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_created uuid,
    url character varying(255),
    framework character varying(255),
    deployable boolean DEFAULT true NOT NULL
);


ALTER TABLE public.directus_deployment_projects OWNER TO postgres;

--
-- Name: directus_deployment_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_deployment_runs (
    id uuid NOT NULL,
    project uuid NOT NULL,
    external_id character varying(255) NOT NULL,
    target character varying(255) NOT NULL,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_created uuid,
    status character varying(255),
    url character varying(255),
    started_at timestamp with time zone,
    completed_at timestamp with time zone
);


ALTER TABLE public.directus_deployment_runs OWNER TO postgres;

--
-- Name: directus_deployments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_deployments (
    id uuid NOT NULL,
    provider character varying(255) NOT NULL,
    credentials text,
    options text,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_created uuid,
    webhook_ids json,
    webhook_secret character varying(255),
    last_synced_at timestamp with time zone
);


ALTER TABLE public.directus_deployments OWNER TO postgres;

--
-- Name: directus_extensions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_extensions (
    enabled boolean DEFAULT true NOT NULL,
    id uuid NOT NULL,
    folder character varying(255) NOT NULL,
    source character varying(255) NOT NULL,
    bundle uuid
);


ALTER TABLE public.directus_extensions OWNER TO postgres;

--
-- Name: directus_fields; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_fields (
    id integer NOT NULL,
    collection character varying(64) NOT NULL,
    field character varying(64) NOT NULL,
    special character varying(64),
    interface character varying(64),
    options json,
    display character varying(64),
    display_options json,
    readonly boolean DEFAULT false NOT NULL,
    hidden boolean DEFAULT false NOT NULL,
    sort integer,
    width character varying(30) DEFAULT 'full'::character varying,
    translations json,
    note text,
    conditions json,
    required boolean DEFAULT false,
    "group" character varying(64),
    validation json,
    validation_message text,
    searchable boolean DEFAULT true NOT NULL
);


ALTER TABLE public.directus_fields OWNER TO postgres;

--
-- Name: directus_fields_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.directus_fields_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.directus_fields_id_seq OWNER TO postgres;

--
-- Name: directus_fields_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.directus_fields_id_seq OWNED BY public.directus_fields.id;


--
-- Name: directus_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_files (
    id uuid NOT NULL,
    storage character varying(255) NOT NULL,
    filename_disk character varying(255),
    filename_download character varying(255) NOT NULL,
    title character varying(255),
    type character varying(255),
    folder uuid,
    uploaded_by uuid,
    created_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP CONSTRAINT directus_files_uploaded_on_not_null NOT NULL,
    modified_by uuid,
    modified_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    charset character varying(50),
    filesize bigint,
    width integer,
    height integer,
    duration integer,
    embed character varying(200),
    description text,
    location text,
    tags text,
    metadata json,
    focal_point_x integer,
    focal_point_y integer,
    tus_id character varying(64),
    tus_data json,
    uploaded_on timestamp with time zone
);


ALTER TABLE public.directus_files OWNER TO postgres;

--
-- Name: directus_flows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_flows (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    icon character varying(64),
    color character varying(255),
    description text,
    status character varying(255) DEFAULT 'active'::character varying NOT NULL,
    trigger character varying(255),
    accountability character varying(255) DEFAULT 'all'::character varying,
    options json,
    operation uuid,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_created uuid
);


ALTER TABLE public.directus_flows OWNER TO postgres;

--
-- Name: directus_folders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_folders (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    parent uuid
);


ALTER TABLE public.directus_folders OWNER TO postgres;

--
-- Name: directus_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_migrations (
    version character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.directus_migrations OWNER TO postgres;

--
-- Name: directus_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_notifications (
    id integer NOT NULL,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(255) DEFAULT 'inbox'::character varying,
    recipient uuid NOT NULL,
    sender uuid,
    subject character varying(255) NOT NULL,
    message text,
    collection character varying(64),
    item character varying(255)
);


ALTER TABLE public.directus_notifications OWNER TO postgres;

--
-- Name: directus_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.directus_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.directus_notifications_id_seq OWNER TO postgres;

--
-- Name: directus_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.directus_notifications_id_seq OWNED BY public.directus_notifications.id;


--
-- Name: directus_operations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_operations (
    id uuid NOT NULL,
    name character varying(255),
    key character varying(255) NOT NULL,
    type character varying(255) NOT NULL,
    position_x integer NOT NULL,
    position_y integer NOT NULL,
    options json,
    resolve uuid,
    reject uuid,
    flow uuid NOT NULL,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_created uuid
);


ALTER TABLE public.directus_operations OWNER TO postgres;

--
-- Name: directus_panels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_panels (
    id uuid NOT NULL,
    dashboard uuid NOT NULL,
    name character varying(255),
    icon character varying(64) DEFAULT NULL::character varying,
    color character varying(10),
    show_header boolean DEFAULT false NOT NULL,
    note text,
    type character varying(255) NOT NULL,
    position_x integer NOT NULL,
    position_y integer NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    options json,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_created uuid
);


ALTER TABLE public.directus_panels OWNER TO postgres;

--
-- Name: directus_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_permissions (
    id integer NOT NULL,
    collection character varying(64) NOT NULL,
    action character varying(10) NOT NULL,
    permissions json,
    validation json,
    presets json,
    fields text,
    policy uuid NOT NULL
);


ALTER TABLE public.directus_permissions OWNER TO postgres;

--
-- Name: directus_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.directus_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.directus_permissions_id_seq OWNER TO postgres;

--
-- Name: directus_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.directus_permissions_id_seq OWNED BY public.directus_permissions.id;


--
-- Name: directus_policies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_policies (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    icon character varying(64) DEFAULT 'badge'::character varying NOT NULL,
    description text,
    ip_access text,
    enforce_tfa boolean DEFAULT false NOT NULL,
    admin_access boolean DEFAULT false NOT NULL,
    app_access boolean DEFAULT false NOT NULL
);


ALTER TABLE public.directus_policies OWNER TO postgres;

--
-- Name: directus_presets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_presets (
    id integer NOT NULL,
    bookmark character varying(255),
    "user" uuid,
    role uuid,
    collection character varying(64),
    search character varying(100),
    layout character varying(100) DEFAULT 'tabular'::character varying,
    layout_query json,
    layout_options json,
    refresh_interval integer,
    filter json,
    icon character varying(64) DEFAULT 'bookmark'::character varying,
    color character varying(255)
);


ALTER TABLE public.directus_presets OWNER TO postgres;

--
-- Name: directus_presets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.directus_presets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.directus_presets_id_seq OWNER TO postgres;

--
-- Name: directus_presets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.directus_presets_id_seq OWNED BY public.directus_presets.id;


--
-- Name: directus_relations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_relations (
    id integer NOT NULL,
    many_collection character varying(64) NOT NULL,
    many_field character varying(64) NOT NULL,
    one_collection character varying(64),
    one_field character varying(64),
    one_collection_field character varying(64),
    one_allowed_collections text,
    junction_field character varying(64),
    sort_field character varying(64),
    one_deselect_action character varying(255) DEFAULT 'nullify'::character varying NOT NULL
);


ALTER TABLE public.directus_relations OWNER TO postgres;

--
-- Name: directus_relations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.directus_relations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.directus_relations_id_seq OWNER TO postgres;

--
-- Name: directus_relations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.directus_relations_id_seq OWNED BY public.directus_relations.id;


--
-- Name: directus_revisions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_revisions (
    id integer NOT NULL,
    activity integer NOT NULL,
    collection character varying(64) NOT NULL,
    item character varying(255) NOT NULL,
    data json,
    delta json,
    parent integer,
    version uuid
);


ALTER TABLE public.directus_revisions OWNER TO postgres;

--
-- Name: directus_revisions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.directus_revisions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.directus_revisions_id_seq OWNER TO postgres;

--
-- Name: directus_revisions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.directus_revisions_id_seq OWNED BY public.directus_revisions.id;


--
-- Name: directus_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_roles (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    icon character varying(64) DEFAULT 'supervised_user_circle'::character varying NOT NULL,
    description text,
    parent uuid
);


ALTER TABLE public.directus_roles OWNER TO postgres;

--
-- Name: directus_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_sessions (
    token character varying(64) NOT NULL,
    "user" uuid,
    expires timestamp with time zone NOT NULL,
    ip character varying(255),
    user_agent text,
    share uuid,
    origin character varying(255),
    next_token character varying(64)
);


ALTER TABLE public.directus_sessions OWNER TO postgres;

--
-- Name: directus_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_settings (
    id integer NOT NULL,
    project_name character varying(100) DEFAULT 'Directus'::character varying NOT NULL,
    project_url character varying(255),
    project_color character varying(255) DEFAULT '#6644FF'::character varying NOT NULL,
    project_logo uuid,
    public_foreground uuid,
    public_background uuid,
    public_note text,
    auth_login_attempts integer DEFAULT 25,
    auth_password_policy character varying(100),
    storage_asset_transform character varying(7) DEFAULT 'all'::character varying,
    storage_asset_presets json,
    custom_css text,
    storage_default_folder uuid,
    basemaps json,
    mapbox_key character varying(255),
    module_bar json,
    project_descriptor character varying(100),
    default_language character varying(255) DEFAULT 'en-US'::character varying NOT NULL,
    custom_aspect_ratios json,
    public_favicon uuid,
    default_appearance character varying(255) DEFAULT 'auto'::character varying NOT NULL,
    default_theme_light character varying(255),
    theme_light_overrides json,
    default_theme_dark character varying(255),
    theme_dark_overrides json,
    report_error_url character varying(255),
    report_bug_url character varying(255),
    report_feature_url character varying(255),
    public_registration boolean DEFAULT false NOT NULL,
    public_registration_verify_email boolean DEFAULT true NOT NULL,
    public_registration_role uuid,
    public_registration_email_filter json,
    visual_editor_urls json,
    project_id uuid,
    mcp_enabled boolean DEFAULT false NOT NULL,
    mcp_allow_deletes boolean DEFAULT false NOT NULL,
    mcp_prompts_collection character varying(255) DEFAULT NULL::character varying,
    mcp_system_prompt_enabled boolean DEFAULT true NOT NULL,
    mcp_system_prompt text,
    project_owner character varying(255),
    project_usage character varying(255),
    org_name character varying(255),
    product_updates boolean,
    project_status character varying(255),
    ai_openai_api_key text,
    ai_anthropic_api_key text,
    ai_system_prompt text,
    ai_google_api_key text,
    ai_openai_compatible_api_key text,
    ai_openai_compatible_base_url text,
    ai_openai_compatible_name text,
    ai_openai_compatible_models json,
    ai_openai_compatible_headers json,
    ai_openai_allowed_models json,
    ai_anthropic_allowed_models json,
    ai_google_allowed_models json,
    collaborative_editing_enabled boolean DEFAULT false NOT NULL
);


ALTER TABLE public.directus_settings OWNER TO postgres;

--
-- Name: directus_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.directus_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.directus_settings_id_seq OWNER TO postgres;

--
-- Name: directus_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.directus_settings_id_seq OWNED BY public.directus_settings.id;


--
-- Name: directus_shares; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_shares (
    id uuid NOT NULL,
    name character varying(255),
    collection character varying(64) NOT NULL,
    item character varying(255) NOT NULL,
    role uuid,
    password character varying(255),
    user_created uuid,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    date_start timestamp with time zone,
    date_end timestamp with time zone,
    times_used integer DEFAULT 0,
    max_uses integer
);


ALTER TABLE public.directus_shares OWNER TO postgres;

--
-- Name: directus_translations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_translations (
    id uuid NOT NULL,
    language character varying(255) NOT NULL,
    key character varying(255) NOT NULL,
    value text NOT NULL
);


ALTER TABLE public.directus_translations OWNER TO postgres;

--
-- Name: directus_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_users (
    id uuid NOT NULL,
    first_name character varying(50),
    last_name character varying(50),
    email character varying(128),
    password character varying(255),
    location character varying(255),
    title character varying(50),
    description text,
    tags json,
    avatar uuid,
    language character varying(255) DEFAULT NULL::character varying,
    tfa_secret character varying(255),
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    role uuid,
    token character varying(255),
    last_access timestamp with time zone,
    last_page character varying(255),
    provider character varying(128) DEFAULT 'default'::character varying NOT NULL,
    external_identifier character varying(255),
    auth_data json,
    email_notifications boolean DEFAULT true,
    appearance character varying(255),
    theme_dark character varying(255),
    theme_light character varying(255),
    theme_light_overrides json,
    theme_dark_overrides json,
    text_direction character varying(255) DEFAULT 'auto'::character varying NOT NULL
);


ALTER TABLE public.directus_users OWNER TO postgres;

--
-- Name: directus_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_versions (
    id uuid NOT NULL,
    key character varying(64) NOT NULL,
    name character varying(255),
    collection character varying(64) NOT NULL,
    item character varying(255) NOT NULL,
    hash character varying(255),
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    date_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_created uuid,
    user_updated uuid,
    delta json
);


ALTER TABLE public.directus_versions OWNER TO postgres;

--
-- Name: post; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.post (
    id integer NOT NULL,
    name character varying(256),
    "createdById" character varying(255) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone
);


ALTER TABLE public.post OWNER TO postgres;

--
-- Name: post_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.post ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.post_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: recent_activity_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recent_activity_log (
    id character varying(255) NOT NULL,
    "entityType" character varying(50) NOT NULL,
    "entityId" character varying(255) NOT NULL,
    "actorUserId" character varying(255),
    "actorName" character varying(255) NOT NULL,
    action character varying(255) NOT NULL,
    "targetName" character varying(255) NOT NULL,
    "targetStatus" character varying(255) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.recent_activity_log OWNER TO postgres;

--
-- Name: session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session (
    "sessionToken" character varying(255) NOT NULL,
    "userId" character varying(255) NOT NULL,
    expires timestamp with time zone NOT NULL
);


ALTER TABLE public.session OWNER TO postgres;

--
-- Name: user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."user" (
    id character varying(255) NOT NULL,
    name character varying(255),
    email character varying(255) NOT NULL,
    password character varying(255),
    "passwordChangedAt" timestamp with time zone,
    "hasSeenWelcomeModal" boolean DEFAULT true NOT NULL,
    "emailVerified" timestamp with time zone,
    image character varying(255)
);


ALTER TABLE public."user" OWNER TO postgres;

--
-- Name: vacancy; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vacancy (
    id character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    level character varying(100),
    status character varying(50) DEFAULT 'active'::character varying,
    city character varying(255),
    responses integer DEFAULT 0,
    "workType" character varying(100),
    "salaryExpectation" integer,
    "salaryCurrency" character varying(10) DEFAULT 'UZS'::character varying,
    "workScheduleStart" character varying(10) DEFAULT '09:00'::character varying,
    "workScheduleEnd" character varying(10) DEFAULT '18:00'::character varying,
    comments text,
    tasks text,
    team text,
    "companyDescription" text,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone
);


ALTER TABLE public.vacancy OWNER TO postgres;

--
-- Name: vacancy_level_option; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vacancy_level_option (
    value character varying(50) NOT NULL,
    label character varying(255) NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


ALTER TABLE public.vacancy_level_option OWNER TO postgres;

--
-- Name: vacancy_status_option; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vacancy_status_option (
    value character varying(50) NOT NULL,
    label character varying(255) NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


ALTER TABLE public.vacancy_status_option OWNER TO postgres;

--
-- Name: vacancy_work_type_option; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vacancy_work_type_option (
    value character varying(50) NOT NULL,
    label character varying(255) NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


ALTER TABLE public.vacancy_work_type_option OWNER TO postgres;

--
-- Name: verification_token; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.verification_token (
    identifier character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    expires timestamp with time zone NOT NULL
);


ALTER TABLE public.verification_token OWNER TO postgres;

--
-- Name: directus_activity id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_activity ALTER COLUMN id SET DEFAULT nextval('public.directus_activity_id_seq'::regclass);


--
-- Name: directus_fields id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_fields ALTER COLUMN id SET DEFAULT nextval('public.directus_fields_id_seq'::regclass);


--
-- Name: directus_notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_notifications ALTER COLUMN id SET DEFAULT nextval('public.directus_notifications_id_seq'::regclass);


--
-- Name: directus_permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_permissions ALTER COLUMN id SET DEFAULT nextval('public.directus_permissions_id_seq'::regclass);


--
-- Name: directus_presets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_presets ALTER COLUMN id SET DEFAULT nextval('public.directus_presets_id_seq'::regclass);


--
-- Name: directus_relations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_relations ALTER COLUMN id SET DEFAULT nextval('public.directus_relations_id_seq'::regclass);


--
-- Name: directus_revisions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_revisions ALTER COLUMN id SET DEFAULT nextval('public.directus_revisions_id_seq'::regclass);


--
-- Name: directus_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_settings ALTER COLUMN id SET DEFAULT nextval('public.directus_settings_id_seq'::regclass);


--
-- Data for Name: account; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.account ("userId", type, provider, "providerAccountId", refresh_token, access_token, expires_at, token_type, scope, id_token, session_state) FROM stdin;
\.


--
-- Data for Name: candidate; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.candidate (id, "fullName", city, "salaryExpectation", "salaryCurrency", "currentPosition", source, status, "resumeUrl", "resumeFileName", "resumeFileSize", experience, "matchScore", "aiAnalysis", contacts, skills, languages, tags, "workExperience", education, notes, activities, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: candidate_contact_type; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.candidate_contact_type (value, label, "sortOrder", "isActive") FROM stdin;
telegram	Telegram	1	t
phone	Телефон	2	t
email	Email	3	t
whatsapp	WhatsApp	4	t
\.


--
-- Data for Name: candidate_language; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.candidate_language (value, label, "sortOrder", "isActive") FROM stdin;
russian	Русский	1	t
uzbek	Узбекский	2	t
english	Английский	3	t
german	Немецкий	4	t
french	Французский	5	t
spanish	Испанский	6	t
korean	Корейский	7	t
chinese	Китайский	8	t
\.


--
-- Data for Name: candidate_language_level; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.candidate_language_level (value, label, "sortOrder", "isActive") FROM stdin;
A1	A1 - Начальный	1	t
A2	A2 - Элементарный	2	t
B1	B1 - Средний	3	t
B2	B2 - Выше среднего	4	t
C1	C1 - Продвинутый	5	t
C2	C2 - Владение в совершенстве	6	t
\.


--
-- Data for Name: candidate_position; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.candidate_position (value, label, "sortOrder", "isActive") FROM stdin;
frontend_developer	Frontend Developer	1	t
backend_developer	Backend Developer	2	t
fullstack_developer	Fullstack Developer	3	t
product_designer	Product Designer	4	t
graphic_designer	Graphic Designer	5	t
project_manager	Project Manager	6	t
hr_manager	HR Manager	7	t
marketing_manager	Marketing Manager	8	t
\.


--
-- Data for Name: candidate_skill; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.candidate_skill (value, label, "sortOrder", "isActive") FROM stdin;
React	React	1	t
TypeScript	TypeScript	2	t
JavaScript	JavaScript	3	t
Node.js	Node.js	4	t
Python	Python	5	t
Figma	Figma	6	t
Adobe Photoshop	Adobe Photoshop	7	t
Adobe Illustrator	Adobe Illustrator	8	t
Коммуникабельность	Коммуникабельность	9	t
Креативность	Креативность	10	t
Управление проектами	Управление проектами	11	t
Аналитика	Аналитика	12	t
\.


--
-- Data for Name: candidate_source; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.candidate_source (value, label, "sortOrder", "isActive") FROM stdin;
hh.uz	hh.uz	1	t
linkedin	LinkedIn	2	t
telegram	Telegram	3	t
referral	Реферал	4	t
other	Другое	5	t
\.


--
-- Data for Name: candidate_status_option; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.candidate_status_option (value, label, "sortOrder", "isActive") FROM stdin;
new	Новый	1	t
screening	Скрининг	2	t
interview	Интервью	3	t
offer	Оффер	4	t
hired	Нанят	5	t
rejected	Отклонен	6	t
\.


--
-- Data for Name: directus_access; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_access (id, role, "user", policy, sort) FROM stdin;
cb4215ff-fb70-4503-bc17-98cacfae32c6	\N	\N	abf8a154-5b1c-4a46-ac9c-7300570f4f17	1
57cc71d2-7fdf-41b8-aea2-ab98875a69bd	d3527d9b-822a-4b65-ad93-85b31723c95b	\N	91b2d384-cd2c-4a35-9cdd-5c5aaf068cbd	\N
463f36b0-bd00-4928-a18f-9c8529b62cc6	\N	6fe6b4f4-1211-4bc1-b8a5-a7f07dba2033	91b2d384-cd2c-4a35-9cdd-5c5aaf068cbd	\N
\.


--
-- Data for Name: directus_activity; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_activity (id, action, "user", "timestamp", ip, user_agent, collection, item, origin) FROM stdin;
1	login	6fe6b4f4-1211-4bc1-b8a5-a7f07dba2033	2026-03-13 10:11:22.969+00	45.153.60.68	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	directus_users	6fe6b4f4-1211-4bc1-b8a5-a7f07dba2033	https://backend.ilovehr.uz
2	update	6fe6b4f4-1211-4bc1-b8a5-a7f07dba2033	2026-03-13 10:11:31.022+00	45.153.60.68	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	directus_settings	1	https://backend.ilovehr.uz
3	login	6fe6b4f4-1211-4bc1-b8a5-a7f07dba2033	2026-03-16 11:05:04.191+00	188.113.200.215	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	directus_users	6fe6b4f4-1211-4bc1-b8a5-a7f07dba2033	https://backend.ilovehr.uz
4	create	6fe6b4f4-1211-4bc1-b8a5-a7f07dba2033	2026-03-17 06:27:06.155+00	185.139.137.125	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	directus_collections	account	https://backend.ilovehr.uz
5	create	6fe6b4f4-1211-4bc1-b8a5-a7f07dba2033	2026-03-17 06:28:24.921+00	185.139.137.125	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	directus_access	463f36b0-bd00-4928-a18f-9c8529b62cc6	https://backend.ilovehr.uz
6	update	6fe6b4f4-1211-4bc1-b8a5-a7f07dba2033	2026-03-17 06:28:24.924+00	185.139.137.125	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	directus_policies	91b2d384-cd2c-4a35-9cdd-5c5aaf068cbd	https://backend.ilovehr.uz
\.


--
-- Data for Name: directus_collections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_collections (collection, icon, note, display_template, hidden, singleton, translations, archive_field, archive_app_filter, archive_value, unarchive_value, sort_field, accountability, color, item_duplication_fields, sort, "group", collapse, preview_url, versioning) FROM stdin;
account	\N	\N	\N	f	f	\N	\N	t	\N	\N	\N	all	\N	\N	\N	\N	open	\N	f
\.


--
-- Data for Name: directus_comments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_comments (id, collection, item, comment, date_created, date_updated, user_created, user_updated) FROM stdin;
\.


--
-- Data for Name: directus_dashboards; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_dashboards (id, name, icon, note, date_created, user_created, color) FROM stdin;
\.


--
-- Data for Name: directus_deployment_projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_deployment_projects (id, deployment, external_id, name, date_created, user_created, url, framework, deployable) FROM stdin;
\.


--
-- Data for Name: directus_deployment_runs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_deployment_runs (id, project, external_id, target, date_created, user_created, status, url, started_at, completed_at) FROM stdin;
\.


--
-- Data for Name: directus_deployments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_deployments (id, provider, credentials, options, date_created, user_created, webhook_ids, webhook_secret, last_synced_at) FROM stdin;
\.


--
-- Data for Name: directus_extensions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_extensions (enabled, id, folder, source, bundle) FROM stdin;
\.


--
-- Data for Name: directus_fields; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_fields (id, collection, field, special, interface, options, display, display_options, readonly, hidden, sort, width, translations, note, conditions, required, "group", validation, validation_message, searchable) FROM stdin;
\.


--
-- Data for Name: directus_files; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_files (id, storage, filename_disk, filename_download, title, type, folder, uploaded_by, created_on, modified_by, modified_on, charset, filesize, width, height, duration, embed, description, location, tags, metadata, focal_point_x, focal_point_y, tus_id, tus_data, uploaded_on) FROM stdin;
\.


--
-- Data for Name: directus_flows; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_flows (id, name, icon, color, description, status, trigger, accountability, options, operation, date_created, user_created) FROM stdin;
\.


--
-- Data for Name: directus_folders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_folders (id, name, parent) FROM stdin;
\.


--
-- Data for Name: directus_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_migrations (version, name, "timestamp") FROM stdin;
20201028A	Remove Collection Foreign Keys	2026-03-13 10:07:41.119366+00
20201029A	Remove System Relations	2026-03-13 10:07:41.126157+00
20201029B	Remove System Collections	2026-03-13 10:07:41.138636+00
20201029C	Remove System Fields	2026-03-13 10:07:41.150141+00
20201105A	Add Cascade System Relations	2026-03-13 10:07:41.208249+00
20201105B	Change Webhook URL Type	2026-03-13 10:07:41.2179+00
20210225A	Add Relations Sort Field	2026-03-13 10:07:41.22516+00
20210304A	Remove Locked Fields	2026-03-13 10:07:41.229377+00
20210312A	Webhooks Collections Text	2026-03-13 10:07:41.237787+00
20210331A	Add Refresh Interval	2026-03-13 10:07:41.241437+00
20210415A	Make Filesize Nullable	2026-03-13 10:07:41.25057+00
20210416A	Add Collections Accountability	2026-03-13 10:07:41.256797+00
20210422A	Remove Files Interface	2026-03-13 10:07:41.259429+00
20210506A	Rename Interfaces	2026-03-13 10:07:41.281327+00
20210510A	Restructure Relations	2026-03-13 10:07:41.298438+00
20210518A	Add Foreign Key Constraints	2026-03-13 10:07:41.306813+00
20210519A	Add System Fk Triggers	2026-03-13 10:07:41.33591+00
20210521A	Add Collections Icon Color	2026-03-13 10:07:41.339648+00
20210525A	Add Insights	2026-03-13 10:07:41.355454+00
20210608A	Add Deep Clone Config	2026-03-13 10:07:41.359065+00
20210626A	Change Filesize Bigint	2026-03-13 10:07:41.371897+00
20210716A	Add Conditions to Fields	2026-03-13 10:07:41.37532+00
20210721A	Add Default Folder	2026-03-13 10:07:41.381665+00
20210802A	Replace Groups	2026-03-13 10:07:41.386358+00
20210803A	Add Required to Fields	2026-03-13 10:07:41.389822+00
20210805A	Update Groups	2026-03-13 10:07:41.39388+00
20210805B	Change Image Metadata Structure	2026-03-13 10:07:41.39843+00
20210811A	Add Geometry Config	2026-03-13 10:07:41.402729+00
20210831A	Remove Limit Column	2026-03-13 10:07:41.406405+00
20210903A	Add Auth Provider	2026-03-13 10:07:41.422293+00
20210907A	Webhooks Collections Not Null	2026-03-13 10:07:41.430567+00
20210910A	Move Module Setup	2026-03-13 10:07:41.43552+00
20210920A	Webhooks URL Not Null	2026-03-13 10:07:41.445171+00
20210924A	Add Collection Organization	2026-03-13 10:07:41.452651+00
20210927A	Replace Fields Group	2026-03-13 10:07:41.461624+00
20210927B	Replace M2M Interface	2026-03-13 10:07:41.464526+00
20210929A	Rename Login Action	2026-03-13 10:07:41.467401+00
20211007A	Update Presets	2026-03-13 10:07:41.475958+00
20211009A	Add Auth Data	2026-03-13 10:07:41.479492+00
20211016A	Add Webhook Headers	2026-03-13 10:07:41.483103+00
20211103A	Set Unique to User Token	2026-03-13 10:07:41.486836+00
20211103B	Update Special Geometry	2026-03-13 10:07:41.489939+00
20211104A	Remove Collections Listing	2026-03-13 10:07:41.493378+00
20211118A	Add Notifications	2026-03-13 10:07:41.506175+00
20211211A	Add Shares	2026-03-13 10:07:41.523936+00
20211230A	Add Project Descriptor	2026-03-13 10:07:41.527587+00
20220303A	Remove Default Project Color	2026-03-13 10:07:41.541248+00
20220308A	Add Bookmark Icon and Color	2026-03-13 10:07:41.545029+00
20220314A	Add Translation Strings	2026-03-13 10:07:41.548341+00
20220322A	Rename Field Typecast Flags	2026-03-13 10:07:41.552713+00
20220323A	Add Field Validation	2026-03-13 10:07:41.556271+00
20220325A	Fix Typecast Flags	2026-03-13 10:07:41.560507+00
20220325B	Add Default Language	2026-03-13 10:07:41.571024+00
20220402A	Remove Default Value Panel Icon	2026-03-13 10:07:41.579378+00
20220429A	Add Flows	2026-03-13 10:07:41.603792+00
20220429B	Add Color to Insights Icon	2026-03-13 10:07:41.607213+00
20220429C	Drop Non Null From IP of Activity	2026-03-13 10:07:41.610923+00
20220429D	Drop Non Null From Sender of Notifications	2026-03-13 10:07:41.615887+00
20220614A	Rename Hook Trigger to Event	2026-03-13 10:07:41.618271+00
20220801A	Update Notifications Timestamp Column	2026-03-13 10:07:41.62662+00
20220802A	Add Custom Aspect Ratios	2026-03-13 10:07:41.629874+00
20220826A	Add Origin to Accountability	2026-03-13 10:07:41.634386+00
20230401A	Update Material Icons	2026-03-13 10:07:41.64304+00
20230525A	Add Preview Settings	2026-03-13 10:07:41.646049+00
20230526A	Migrate Translation Strings	2026-03-13 10:07:41.653652+00
20230721A	Require Shares Fields	2026-03-13 10:07:41.659965+00
20230823A	Add Content Versioning	2026-03-13 10:07:41.675625+00
20230927A	Themes	2026-03-13 10:07:41.693198+00
20231009A	Update CSV Fields to Text	2026-03-13 10:07:41.697838+00
20231009B	Update Panel Options	2026-03-13 10:07:41.700637+00
20231010A	Add Extensions	2026-03-13 10:07:41.704986+00
20231215A	Add Focalpoints	2026-03-13 10:07:41.708256+00
20240122A	Add Report URL Fields	2026-03-13 10:07:41.711852+00
20240204A	Marketplace	2026-03-13 10:07:41.738398+00
20240305A	Change Useragent Type	2026-03-13 10:07:41.751526+00
20240311A	Deprecate Webhooks	2026-03-13 10:07:41.760873+00
20240422A	Public Registration	2026-03-13 10:07:41.767227+00
20240515A	Add Session Window	2026-03-13 10:07:41.770538+00
20240701A	Add Tus Data	2026-03-13 10:07:41.773945+00
20240716A	Update Files Date Fields	2026-03-13 10:07:41.781905+00
20240806A	Permissions Policies	2026-03-13 10:07:41.823696+00
20240817A	Update Icon Fields Length	2026-03-13 10:07:41.858893+00
20240909A	Separate Comments	2026-03-13 10:07:41.870433+00
20240909B	Consolidate Content Versioning	2026-03-13 10:07:41.874307+00
20240924A	Migrate Legacy Comments	2026-03-13 10:07:41.880217+00
20240924B	Populate Versioning Deltas	2026-03-13 10:07:41.884745+00
20250224A	Visual Editor	2026-03-13 10:07:41.889035+00
20250609A	License Banner	2026-03-13 10:07:41.89441+00
20250613A	Add Project ID	2026-03-13 10:07:41.909145+00
20250718A	Add Direction	2026-03-13 10:07:41.913406+00
20250813A	Add MCP	2026-03-13 10:07:41.918358+00
20251012A	Add Field Searchable	2026-03-13 10:07:41.922266+00
20251014A	Add Project Owner	2026-03-13 10:07:41.971314+00
20251028A	Add Retention Indexes	2026-03-13 10:07:42.041109+00
20251103A	Add AI Settings	2026-03-13 10:07:42.045115+00
20251224A	Remove Webhooks	2026-03-13 10:07:42.050349+00
20260110A	Add AI Provider Settings	2026-03-13 10:07:42.057246+00
20260113A	Add Revisions Index	2026-03-13 10:07:42.078445+00
20260128A	Add Collaborative Editing	2026-03-13 10:07:42.083076+00
20260204A	Add Deployment	2026-03-13 10:07:42.106235+00
20260211A	Add Deployment Webhooks	2026-03-13 10:07:42.114445+00
\.


--
-- Data for Name: directus_notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_notifications (id, "timestamp", status, recipient, sender, subject, message, collection, item) FROM stdin;
\.


--
-- Data for Name: directus_operations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_operations (id, name, key, type, position_x, position_y, options, resolve, reject, flow, date_created, user_created) FROM stdin;
\.


--
-- Data for Name: directus_panels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_panels (id, dashboard, name, icon, color, show_header, note, type, position_x, position_y, width, height, options, date_created, user_created) FROM stdin;
\.


--
-- Data for Name: directus_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_permissions (id, collection, action, permissions, validation, presets, fields, policy) FROM stdin;
\.


--
-- Data for Name: directus_policies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_policies (id, name, icon, description, ip_access, enforce_tfa, admin_access, app_access) FROM stdin;
abf8a154-5b1c-4a46-ac9c-7300570f4f17	$t:public_label	public	$t:public_description	\N	f	f	f
91b2d384-cd2c-4a35-9cdd-5c5aaf068cbd	Policy for Administrator	supervised_user_circle	\N	\N	f	t	t
\.


--
-- Data for Name: directus_presets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_presets (id, bookmark, "user", role, collection, search, layout, layout_query, layout_options, refresh_interval, filter, icon, color) FROM stdin;
1	\N	6fe6b4f4-1211-4bc1-b8a5-a7f07dba2033	\N	account	\N	tabular	\N	\N	\N	\N	bookmark	\N
2	\N	6fe6b4f4-1211-4bc1-b8a5-a7f07dba2033	\N	directus_users	\N	cards	{"cards":{"sort":["email"],"page":1}}	{"cards":{"icon":"account_circle","title":"{{ first_name }} {{ last_name }}","subtitle":"{{ email }}","size":4}}	\N	\N	bookmark	\N
\.


--
-- Data for Name: directus_relations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_relations (id, many_collection, many_field, one_collection, one_field, one_collection_field, one_allowed_collections, junction_field, sort_field, one_deselect_action) FROM stdin;
\.


--
-- Data for Name: directus_revisions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_revisions (id, activity, collection, item, data, delta, parent, version) FROM stdin;
1	2	directus_settings	1	{"id":1,"project_name":"Directus","project_url":null,"project_color":"#6644FF","project_logo":null,"public_foreground":null,"public_background":null,"public_note":null,"auth_login_attempts":25,"auth_password_policy":null,"storage_asset_transform":"all","storage_asset_presets":null,"custom_css":null,"storage_default_folder":null,"basemaps":null,"mapbox_key":null,"module_bar":null,"project_descriptor":null,"default_language":"en-US","custom_aspect_ratios":null,"public_favicon":null,"default_appearance":"auto","default_theme_light":null,"theme_light_overrides":null,"default_theme_dark":null,"theme_dark_overrides":null,"report_error_url":null,"report_bug_url":null,"report_feature_url":null,"public_registration":false,"public_registration_verify_email":true,"public_registration_role":null,"public_registration_email_filter":null,"visual_editor_urls":null,"project_id":"019ce6aa-8952-730b-9ea9-1085a8664c08","mcp_enabled":false,"mcp_allow_deletes":false,"mcp_prompts_collection":null,"mcp_system_prompt_enabled":true,"mcp_system_prompt":null,"project_owner":"sabrina.babakulova@gmail.com","project_usage":"personal","org_name":null,"product_updates":false,"project_status":null,"ai_openai_api_key":null,"ai_anthropic_api_key":null,"ai_system_prompt":null,"ai_google_api_key":null,"ai_openai_compatible_api_key":null,"ai_openai_compatible_base_url":null,"ai_openai_compatible_name":null,"ai_openai_compatible_models":null,"ai_openai_compatible_headers":null,"ai_openai_allowed_models":["gpt-5-nano","gpt-5-mini","gpt-5"],"ai_anthropic_allowed_models":["claude-haiku-4-5","claude-sonnet-4-5"],"ai_google_allowed_models":["gemini-3-pro-preview","gemini-3-flash-preview","gemini-2.5-pro","gemini-2.5-flash"],"collaborative_editing_enabled":false}	{"project_owner":"sabrina.babakulova@gmail.com","project_usage":"personal","org_name":null,"product_updates":false,"project_status":null}	\N	\N
2	4	directus_collections	account	{"collection":"account"}	{"collection":"account"}	\N	\N
3	5	directus_access	463f36b0-bd00-4928-a18f-9c8529b62cc6	{"policy":"91b2d384-cd2c-4a35-9cdd-5c5aaf068cbd","user":{"id":"6fe6b4f4-1211-4bc1-b8a5-a7f07dba2033"}}	{"policy":"91b2d384-cd2c-4a35-9cdd-5c5aaf068cbd","user":{"id":"6fe6b4f4-1211-4bc1-b8a5-a7f07dba2033"}}	\N	\N
\.


--
-- Data for Name: directus_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_roles (id, name, icon, description, parent) FROM stdin;
d3527d9b-822a-4b65-ad93-85b31723c95b	Administrator	supervised_user_circle	\N	\N
\.


--
-- Data for Name: directus_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_sessions (token, "user", expires, ip, user_agent, share, origin, next_token) FROM stdin;
09vpb6LWJos1JcifBz-yXzAG_mwY38SGb-govzKPSvXY0NZrk8u8i_dfnaGivY8Y	6fe6b4f4-1211-4bc1-b8a5-a7f07dba2033	2026-03-17 06:37:18.217+00	185.139.137.125	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	\N	https://backend.ilovehr.uz	rNhsU_R_kCw55MyEBdDuJvcQFfkhp7eiFnUhzVR3xx7BsoATgGBj_-IB2-ivMeEY
rNhsU_R_kCw55MyEBdDuJvcQFfkhp7eiFnUhzVR3xx7BsoATgGBj_-IB2-ivMeEY	6fe6b4f4-1211-4bc1-b8a5-a7f07dba2033	2026-03-18 06:37:08.217+00	185.139.137.125	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	\N	https://backend.ilovehr.uz	\N
\.


--
-- Data for Name: directus_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_settings (id, project_name, project_url, project_color, project_logo, public_foreground, public_background, public_note, auth_login_attempts, auth_password_policy, storage_asset_transform, storage_asset_presets, custom_css, storage_default_folder, basemaps, mapbox_key, module_bar, project_descriptor, default_language, custom_aspect_ratios, public_favicon, default_appearance, default_theme_light, theme_light_overrides, default_theme_dark, theme_dark_overrides, report_error_url, report_bug_url, report_feature_url, public_registration, public_registration_verify_email, public_registration_role, public_registration_email_filter, visual_editor_urls, project_id, mcp_enabled, mcp_allow_deletes, mcp_prompts_collection, mcp_system_prompt_enabled, mcp_system_prompt, project_owner, project_usage, org_name, product_updates, project_status, ai_openai_api_key, ai_anthropic_api_key, ai_system_prompt, ai_google_api_key, ai_openai_compatible_api_key, ai_openai_compatible_base_url, ai_openai_compatible_name, ai_openai_compatible_models, ai_openai_compatible_headers, ai_openai_allowed_models, ai_anthropic_allowed_models, ai_google_allowed_models, collaborative_editing_enabled) FROM stdin;
1	Directus	\N	#6644FF	\N	\N	\N	\N	25	\N	all	\N	\N	\N	\N	\N	\N	\N	en-US	\N	\N	auto	\N	\N	\N	\N	\N	\N	\N	f	t	\N	\N	\N	019ce6aa-8952-730b-9ea9-1085a8664c08	f	f	\N	t	\N	sabrina.babakulova@gmail.com	personal	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	["gpt-5-nano","gpt-5-mini","gpt-5"]	["claude-haiku-4-5","claude-sonnet-4-5"]	["gemini-3-pro-preview","gemini-3-flash-preview","gemini-2.5-pro","gemini-2.5-flash"]	f
\.


--
-- Data for Name: directus_shares; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_shares (id, name, collection, item, role, password, user_created, date_created, date_start, date_end, times_used, max_uses) FROM stdin;
\.


--
-- Data for Name: directus_translations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_translations (id, language, key, value) FROM stdin;
\.


--
-- Data for Name: directus_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_users (id, first_name, last_name, email, password, location, title, description, tags, avatar, language, tfa_secret, status, role, token, last_access, last_page, provider, external_identifier, auth_data, email_notifications, appearance, theme_dark, theme_light, theme_light_overrides, theme_dark_overrides, text_direction) FROM stdin;
6fe6b4f4-1211-4bc1-b8a5-a7f07dba2033	\N	\N	admin@ilovehr.uz	$argon2id$v=19$m=65536,t=3,p=4$QCVy5KWpUfaEnuBLUPXJXA$ZqgLOoXHNVuIfZj7GtJI0Ih9Lo0uTZnFEo1esZH8e24	\N	\N	\N	\N	\N	\N	\N	active	d3527d9b-822a-4b65-ad93-85b31723c95b	\N	2026-03-17 06:37:08.222+00	/files	default	\N	\N	t	\N	\N	\N	\N	\N	auto
\.


--
-- Data for Name: directus_versions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_versions (id, key, name, collection, item, hash, date_created, date_updated, user_created, user_updated, delta) FROM stdin;
\.


--
-- Data for Name: post; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.post (id, name, "createdById", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: recent_activity_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.recent_activity_log (id, "entityType", "entityId", "actorUserId", "actorName", action, "targetName", "targetStatus", "createdAt") FROM stdin;
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.session ("sessionToken", "userId", expires) FROM stdin;
\.


--
-- Data for Name: user; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."user" (id, name, email, password, "passwordChangedAt", "hasSeenWelcomeModal", "emailVerified", image) FROM stdin;
74ab9dcf-d672-49c1-a60f-89334b8f5e46	Мафтуна Зиямова	ziyamovamaftuna0202@gmail.com	$2b$12$ktULkyaqbFWEKzr9/NPuwuJc7I2u7xvz4PeK8qd7PES0T3MaTzafu	\N	t	2026-03-16 11:22:04.26+00	\N
d24665ec-e888-4efc-b758-7559710eb556	Sabrina Babakulova	sabrina.babakulova@gmail.com	$2b$12$938M583JT7V5Izo9ayJZKeGw0xacphgdL4sbyTe9zv2Gt.aC9nzg2	\N	t	2026-03-16 11:42:47.376+00	\N
\.


--
-- Data for Name: vacancy; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vacancy (id, title, level, status, city, responses, "workType", "salaryExpectation", "salaryCurrency", "workScheduleStart", "workScheduleEnd", comments, tasks, team, "companyDescription", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: vacancy_level_option; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vacancy_level_option (value, label, "sortOrder", "isActive") FROM stdin;
intern	Стажер	1	t
junior	Джуниор	2	t
middle	Мидл	3	t
senior	Сеньор	4	t
lead	Лид	5	t
\.


--
-- Data for Name: vacancy_status_option; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vacancy_status_option (value, label, "sortOrder", "isActive") FROM stdin;
active	Активна	1	t
draft	Черновик	2	t
paused	Приостановлена	3	t
closed	Закрыта	4	t
archive	Архив	5	t
\.


--
-- Data for Name: vacancy_work_type_option; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vacancy_work_type_option (value, label, "sortOrder", "isActive") FROM stdin;
office	Офис	1	t
remote	Удаленно	2	t
hybrid	Гибрид	3	t
part-time	Частичная занятость	4	t
\.


--
-- Data for Name: verification_token; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.verification_token (identifier, token, expires) FROM stdin;
rate-limit:register:ziyamovamaftuna0202@gmail.com	be7a5070-d012-412b-9157-b0d5704a7766	2026-03-16 12:21:54.188+00
rate-limit:register-ip:165.132.5.132	25608d5d-d8e5-4dec-9d1d-eb44d570db46	2026-03-16 12:21:54.192+00
rate-limit:register-cooldown:ziyamovamaftuna0202@gmail.com	4dd9bbc6-8d71-433a-aeb4-dad74f2a47d4	2026-03-16 11:22:54.195+00
rate-limit:login-ip:185.139.137.125	2d807d87-883d-44af-9234-68cfa53e1c9f	2026-03-16 11:38:22.259+00
rate-limit:login:admin@ilovehr.uz	727c9ecd-f7d8-4bf2-8234-38bde0c04688	2026-03-16 11:38:31.736+00
rate-limit:login-ip:185.139.137.125	50a572ce-5bf8-46f5-bc9f-b72d29215b1a	2026-03-16 11:38:31.739+00
rate-limit:register:sabrina.babakulova@gmail.com	dff7bddc-d3c4-4f43-9893-39d777ce0258	2026-03-16 12:42:34.621+00
rate-limit:register-ip:45.153.60.215	987eff90-2619-4a90-94be-03eabe967bd5	2026-03-16 12:42:34.624+00
rate-limit:register-cooldown:sabrina.babakulova@gmail.com	2863cfc4-39e4-496d-b659-aeed4d17f5f5	2026-03-16 11:43:34.627+00
\.


--
-- Name: directus_activity_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_activity_id_seq', 6, true);


--
-- Name: directus_fields_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_fields_id_seq', 1, false);


--
-- Name: directus_notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_notifications_id_seq', 1, false);


--
-- Name: directus_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_permissions_id_seq', 1, false);


--
-- Name: directus_presets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_presets_id_seq', 2, true);


--
-- Name: directus_relations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_relations_id_seq', 1, false);


--
-- Name: directus_revisions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_revisions_id_seq', 3, true);


--
-- Name: directus_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_settings_id_seq', 1, true);


--
-- Name: post_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.post_id_seq', 1, false);


--
-- Name: account account_provider_providerAccountId_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY (provider, "providerAccountId");


--
-- Name: candidate_contact_type candidate_contact_type_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_contact_type
    ADD CONSTRAINT candidate_contact_type_pkey PRIMARY KEY (value);


--
-- Name: candidate_language_level candidate_language_level_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_language_level
    ADD CONSTRAINT candidate_language_level_pkey PRIMARY KEY (value);


--
-- Name: candidate_language candidate_language_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_language
    ADD CONSTRAINT candidate_language_pkey PRIMARY KEY (value);


--
-- Name: candidate candidate_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate
    ADD CONSTRAINT candidate_pkey PRIMARY KEY (id);


--
-- Name: candidate_position candidate_position_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_position
    ADD CONSTRAINT candidate_position_pkey PRIMARY KEY (value);


--
-- Name: candidate_skill candidate_skill_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_skill
    ADD CONSTRAINT candidate_skill_pkey PRIMARY KEY (value);


--
-- Name: candidate_source candidate_source_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_source
    ADD CONSTRAINT candidate_source_pkey PRIMARY KEY (value);


--
-- Name: candidate_status_option candidate_status_option_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_status_option
    ADD CONSTRAINT candidate_status_option_pkey PRIMARY KEY (value);


--
-- Name: directus_access directus_access_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_access
    ADD CONSTRAINT directus_access_pkey PRIMARY KEY (id);


--
-- Name: directus_activity directus_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_activity
    ADD CONSTRAINT directus_activity_pkey PRIMARY KEY (id);


--
-- Name: directus_collections directus_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_collections
    ADD CONSTRAINT directus_collections_pkey PRIMARY KEY (collection);


--
-- Name: directus_comments directus_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_comments
    ADD CONSTRAINT directus_comments_pkey PRIMARY KEY (id);


--
-- Name: directus_dashboards directus_dashboards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_dashboards
    ADD CONSTRAINT directus_dashboards_pkey PRIMARY KEY (id);


--
-- Name: directus_deployment_projects directus_deployment_projects_deployment_external_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_deployment_projects
    ADD CONSTRAINT directus_deployment_projects_deployment_external_id_unique UNIQUE (deployment, external_id);


--
-- Name: directus_deployment_projects directus_deployment_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_deployment_projects
    ADD CONSTRAINT directus_deployment_projects_pkey PRIMARY KEY (id);


--
-- Name: directus_deployment_runs directus_deployment_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_deployment_runs
    ADD CONSTRAINT directus_deployment_runs_pkey PRIMARY KEY (id);


--
-- Name: directus_deployments directus_deployments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_deployments
    ADD CONSTRAINT directus_deployments_pkey PRIMARY KEY (id);


--
-- Name: directus_deployments directus_deployments_provider_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_deployments
    ADD CONSTRAINT directus_deployments_provider_unique UNIQUE (provider);


--
-- Name: directus_extensions directus_extensions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_extensions
    ADD CONSTRAINT directus_extensions_pkey PRIMARY KEY (id);


--
-- Name: directus_fields directus_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_fields
    ADD CONSTRAINT directus_fields_pkey PRIMARY KEY (id);


--
-- Name: directus_files directus_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_files
    ADD CONSTRAINT directus_files_pkey PRIMARY KEY (id);


--
-- Name: directus_flows directus_flows_operation_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_flows
    ADD CONSTRAINT directus_flows_operation_unique UNIQUE (operation);


--
-- Name: directus_flows directus_flows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_flows
    ADD CONSTRAINT directus_flows_pkey PRIMARY KEY (id);


--
-- Name: directus_folders directus_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_folders
    ADD CONSTRAINT directus_folders_pkey PRIMARY KEY (id);


--
-- Name: directus_migrations directus_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_migrations
    ADD CONSTRAINT directus_migrations_pkey PRIMARY KEY (version);


--
-- Name: directus_notifications directus_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_notifications
    ADD CONSTRAINT directus_notifications_pkey PRIMARY KEY (id);


--
-- Name: directus_operations directus_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_operations
    ADD CONSTRAINT directus_operations_pkey PRIMARY KEY (id);


--
-- Name: directus_operations directus_operations_reject_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_operations
    ADD CONSTRAINT directus_operations_reject_unique UNIQUE (reject);


--
-- Name: directus_operations directus_operations_resolve_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_operations
    ADD CONSTRAINT directus_operations_resolve_unique UNIQUE (resolve);


--
-- Name: directus_panels directus_panels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_panels
    ADD CONSTRAINT directus_panels_pkey PRIMARY KEY (id);


--
-- Name: directus_permissions directus_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_permissions
    ADD CONSTRAINT directus_permissions_pkey PRIMARY KEY (id);


--
-- Name: directus_policies directus_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_policies
    ADD CONSTRAINT directus_policies_pkey PRIMARY KEY (id);


--
-- Name: directus_presets directus_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_presets
    ADD CONSTRAINT directus_presets_pkey PRIMARY KEY (id);


--
-- Name: directus_relations directus_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_relations
    ADD CONSTRAINT directus_relations_pkey PRIMARY KEY (id);


--
-- Name: directus_revisions directus_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_revisions
    ADD CONSTRAINT directus_revisions_pkey PRIMARY KEY (id);


--
-- Name: directus_roles directus_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_roles
    ADD CONSTRAINT directus_roles_pkey PRIMARY KEY (id);


--
-- Name: directus_sessions directus_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_sessions
    ADD CONSTRAINT directus_sessions_pkey PRIMARY KEY (token);


--
-- Name: directus_settings directus_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_settings
    ADD CONSTRAINT directus_settings_pkey PRIMARY KEY (id);


--
-- Name: directus_shares directus_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_shares
    ADD CONSTRAINT directus_shares_pkey PRIMARY KEY (id);


--
-- Name: directus_translations directus_translations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_translations
    ADD CONSTRAINT directus_translations_pkey PRIMARY KEY (id);


--
-- Name: directus_users directus_users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_users
    ADD CONSTRAINT directus_users_email_unique UNIQUE (email);


--
-- Name: directus_users directus_users_external_identifier_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_users
    ADD CONSTRAINT directus_users_external_identifier_unique UNIQUE (external_identifier);


--
-- Name: directus_users directus_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_users
    ADD CONSTRAINT directus_users_pkey PRIMARY KEY (id);


--
-- Name: directus_users directus_users_token_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_users
    ADD CONSTRAINT directus_users_token_unique UNIQUE (token);


--
-- Name: directus_versions directus_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_versions
    ADD CONSTRAINT directus_versions_pkey PRIMARY KEY (id);


--
-- Name: post post_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post
    ADD CONSTRAINT post_pkey PRIMARY KEY (id);


--
-- Name: recent_activity_log recent_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recent_activity_log
    ADD CONSTRAINT recent_activity_log_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY ("sessionToken");


--
-- Name: user user_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_email_unique UNIQUE (email);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: vacancy_level_option vacancy_level_option_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vacancy_level_option
    ADD CONSTRAINT vacancy_level_option_pkey PRIMARY KEY (value);


--
-- Name: vacancy vacancy_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vacancy
    ADD CONSTRAINT vacancy_pkey PRIMARY KEY (id);


--
-- Name: vacancy_status_option vacancy_status_option_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vacancy_status_option
    ADD CONSTRAINT vacancy_status_option_pkey PRIMARY KEY (value);


--
-- Name: vacancy_work_type_option vacancy_work_type_option_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vacancy_work_type_option
    ADD CONSTRAINT vacancy_work_type_option_pkey PRIMARY KEY (value);


--
-- Name: verification_token verification_token_identifier_token_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verification_token
    ADD CONSTRAINT verification_token_identifier_token_pk PRIMARY KEY (identifier, token);


--
-- Name: account_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX account_user_id_idx ON public.account USING btree ("userId");


--
-- Name: candidate_city_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX candidate_city_idx ON public.candidate USING btree (city);


--
-- Name: candidate_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX candidate_created_at_idx ON public.candidate USING btree ("createdAt");


--
-- Name: candidate_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX candidate_name_idx ON public.candidate USING btree ("fullName");


--
-- Name: created_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX created_by_idx ON public.post USING btree ("createdById");


--
-- Name: directus_activity_timestamp_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX directus_activity_timestamp_index ON public.directus_activity USING btree ("timestamp");


--
-- Name: directus_revisions_activity_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX directus_revisions_activity_index ON public.directus_revisions USING btree (activity);


--
-- Name: directus_revisions_parent_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX directus_revisions_parent_index ON public.directus_revisions USING btree (parent);


--
-- Name: name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX name_idx ON public.post USING btree (name);


--
-- Name: recent_activity_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX recent_activity_created_at_idx ON public.recent_activity_log USING btree ("createdAt");


--
-- Name: recent_activity_entity_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX recent_activity_entity_idx ON public.recent_activity_log USING btree ("entityType", "entityId");


--
-- Name: t_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX t_user_id_idx ON public.session USING btree ("userId");


--
-- Name: vacancy_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX vacancy_status_idx ON public.vacancy USING btree (status);


--
-- Name: vacancy_title_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX vacancy_title_idx ON public.vacancy USING btree (title);


--
-- Name: account account_userId_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES public."user"(id);


--
-- Name: directus_access directus_access_policy_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_access
    ADD CONSTRAINT directus_access_policy_foreign FOREIGN KEY (policy) REFERENCES public.directus_policies(id) ON DELETE CASCADE;


--
-- Name: directus_access directus_access_role_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_access
    ADD CONSTRAINT directus_access_role_foreign FOREIGN KEY (role) REFERENCES public.directus_roles(id) ON DELETE CASCADE;


--
-- Name: directus_access directus_access_user_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_access
    ADD CONSTRAINT directus_access_user_foreign FOREIGN KEY ("user") REFERENCES public.directus_users(id) ON DELETE CASCADE;


--
-- Name: directus_collections directus_collections_group_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_collections
    ADD CONSTRAINT directus_collections_group_foreign FOREIGN KEY ("group") REFERENCES public.directus_collections(collection);


--
-- Name: directus_comments directus_comments_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_comments
    ADD CONSTRAINT directus_comments_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_comments directus_comments_user_updated_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_comments
    ADD CONSTRAINT directus_comments_user_updated_foreign FOREIGN KEY (user_updated) REFERENCES public.directus_users(id);


--
-- Name: directus_dashboards directus_dashboards_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_dashboards
    ADD CONSTRAINT directus_dashboards_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_deployment_projects directus_deployment_projects_deployment_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_deployment_projects
    ADD CONSTRAINT directus_deployment_projects_deployment_foreign FOREIGN KEY (deployment) REFERENCES public.directus_deployments(id) ON DELETE CASCADE;


--
-- Name: directus_deployment_projects directus_deployment_projects_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_deployment_projects
    ADD CONSTRAINT directus_deployment_projects_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_deployment_runs directus_deployment_runs_project_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_deployment_runs
    ADD CONSTRAINT directus_deployment_runs_project_foreign FOREIGN KEY (project) REFERENCES public.directus_deployment_projects(id) ON DELETE CASCADE;


--
-- Name: directus_deployment_runs directus_deployment_runs_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_deployment_runs
    ADD CONSTRAINT directus_deployment_runs_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_deployments directus_deployments_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_deployments
    ADD CONSTRAINT directus_deployments_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_files directus_files_folder_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_files
    ADD CONSTRAINT directus_files_folder_foreign FOREIGN KEY (folder) REFERENCES public.directus_folders(id) ON DELETE SET NULL;


--
-- Name: directus_files directus_files_modified_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_files
    ADD CONSTRAINT directus_files_modified_by_foreign FOREIGN KEY (modified_by) REFERENCES public.directus_users(id);


--
-- Name: directus_files directus_files_uploaded_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_files
    ADD CONSTRAINT directus_files_uploaded_by_foreign FOREIGN KEY (uploaded_by) REFERENCES public.directus_users(id);


--
-- Name: directus_flows directus_flows_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_flows
    ADD CONSTRAINT directus_flows_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_folders directus_folders_parent_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_folders
    ADD CONSTRAINT directus_folders_parent_foreign FOREIGN KEY (parent) REFERENCES public.directus_folders(id);


--
-- Name: directus_notifications directus_notifications_recipient_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_notifications
    ADD CONSTRAINT directus_notifications_recipient_foreign FOREIGN KEY (recipient) REFERENCES public.directus_users(id) ON DELETE CASCADE;


--
-- Name: directus_notifications directus_notifications_sender_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_notifications
    ADD CONSTRAINT directus_notifications_sender_foreign FOREIGN KEY (sender) REFERENCES public.directus_users(id);


--
-- Name: directus_operations directus_operations_flow_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_operations
    ADD CONSTRAINT directus_operations_flow_foreign FOREIGN KEY (flow) REFERENCES public.directus_flows(id) ON DELETE CASCADE;


--
-- Name: directus_operations directus_operations_reject_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_operations
    ADD CONSTRAINT directus_operations_reject_foreign FOREIGN KEY (reject) REFERENCES public.directus_operations(id);


--
-- Name: directus_operations directus_operations_resolve_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_operations
    ADD CONSTRAINT directus_operations_resolve_foreign FOREIGN KEY (resolve) REFERENCES public.directus_operations(id);


--
-- Name: directus_operations directus_operations_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_operations
    ADD CONSTRAINT directus_operations_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_panels directus_panels_dashboard_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_panels
    ADD CONSTRAINT directus_panels_dashboard_foreign FOREIGN KEY (dashboard) REFERENCES public.directus_dashboards(id) ON DELETE CASCADE;


--
-- Name: directus_panels directus_panels_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_panels
    ADD CONSTRAINT directus_panels_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_permissions directus_permissions_policy_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_permissions
    ADD CONSTRAINT directus_permissions_policy_foreign FOREIGN KEY (policy) REFERENCES public.directus_policies(id) ON DELETE CASCADE;


--
-- Name: directus_presets directus_presets_role_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_presets
    ADD CONSTRAINT directus_presets_role_foreign FOREIGN KEY (role) REFERENCES public.directus_roles(id) ON DELETE CASCADE;


--
-- Name: directus_presets directus_presets_user_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_presets
    ADD CONSTRAINT directus_presets_user_foreign FOREIGN KEY ("user") REFERENCES public.directus_users(id) ON DELETE CASCADE;


--
-- Name: directus_revisions directus_revisions_activity_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_revisions
    ADD CONSTRAINT directus_revisions_activity_foreign FOREIGN KEY (activity) REFERENCES public.directus_activity(id) ON DELETE CASCADE;


--
-- Name: directus_revisions directus_revisions_parent_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_revisions
    ADD CONSTRAINT directus_revisions_parent_foreign FOREIGN KEY (parent) REFERENCES public.directus_revisions(id);


--
-- Name: directus_revisions directus_revisions_version_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_revisions
    ADD CONSTRAINT directus_revisions_version_foreign FOREIGN KEY (version) REFERENCES public.directus_versions(id) ON DELETE CASCADE;


--
-- Name: directus_roles directus_roles_parent_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_roles
    ADD CONSTRAINT directus_roles_parent_foreign FOREIGN KEY (parent) REFERENCES public.directus_roles(id);


--
-- Name: directus_sessions directus_sessions_share_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_sessions
    ADD CONSTRAINT directus_sessions_share_foreign FOREIGN KEY (share) REFERENCES public.directus_shares(id) ON DELETE CASCADE;


--
-- Name: directus_sessions directus_sessions_user_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_sessions
    ADD CONSTRAINT directus_sessions_user_foreign FOREIGN KEY ("user") REFERENCES public.directus_users(id) ON DELETE CASCADE;


--
-- Name: directus_settings directus_settings_project_logo_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_settings
    ADD CONSTRAINT directus_settings_project_logo_foreign FOREIGN KEY (project_logo) REFERENCES public.directus_files(id);


--
-- Name: directus_settings directus_settings_public_background_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_settings
    ADD CONSTRAINT directus_settings_public_background_foreign FOREIGN KEY (public_background) REFERENCES public.directus_files(id);


--
-- Name: directus_settings directus_settings_public_favicon_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_settings
    ADD CONSTRAINT directus_settings_public_favicon_foreign FOREIGN KEY (public_favicon) REFERENCES public.directus_files(id);


--
-- Name: directus_settings directus_settings_public_foreground_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_settings
    ADD CONSTRAINT directus_settings_public_foreground_foreign FOREIGN KEY (public_foreground) REFERENCES public.directus_files(id);


--
-- Name: directus_settings directus_settings_public_registration_role_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_settings
    ADD CONSTRAINT directus_settings_public_registration_role_foreign FOREIGN KEY (public_registration_role) REFERENCES public.directus_roles(id) ON DELETE SET NULL;


--
-- Name: directus_settings directus_settings_storage_default_folder_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_settings
    ADD CONSTRAINT directus_settings_storage_default_folder_foreign FOREIGN KEY (storage_default_folder) REFERENCES public.directus_folders(id) ON DELETE SET NULL;


--
-- Name: directus_shares directus_shares_collection_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_shares
    ADD CONSTRAINT directus_shares_collection_foreign FOREIGN KEY (collection) REFERENCES public.directus_collections(collection) ON DELETE CASCADE;


--
-- Name: directus_shares directus_shares_role_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_shares
    ADD CONSTRAINT directus_shares_role_foreign FOREIGN KEY (role) REFERENCES public.directus_roles(id) ON DELETE CASCADE;


--
-- Name: directus_shares directus_shares_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_shares
    ADD CONSTRAINT directus_shares_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_users directus_users_role_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_users
    ADD CONSTRAINT directus_users_role_foreign FOREIGN KEY (role) REFERENCES public.directus_roles(id) ON DELETE SET NULL;


--
-- Name: directus_versions directus_versions_collection_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_versions
    ADD CONSTRAINT directus_versions_collection_foreign FOREIGN KEY (collection) REFERENCES public.directus_collections(collection) ON DELETE CASCADE;


--
-- Name: directus_versions directus_versions_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_versions
    ADD CONSTRAINT directus_versions_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_versions directus_versions_user_updated_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_versions
    ADD CONSTRAINT directus_versions_user_updated_foreign FOREIGN KEY (user_updated) REFERENCES public.directus_users(id);


--
-- Name: post post_createdById_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post
    ADD CONSTRAINT "post_createdById_user_id_fk" FOREIGN KEY ("createdById") REFERENCES public."user"(id);


--
-- Name: recent_activity_log recent_activity_log_actorUserId_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recent_activity_log
    ADD CONSTRAINT "recent_activity_log_actorUserId_user_id_fk" FOREIGN KEY ("actorUserId") REFERENCES public."user"(id);


--
-- Name: session session_userId_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES public."user"(id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict oMVgdMmz6eh8mbZJku9HFq8ceAWjFTPOeisioihI5xLI3xBlYpqxZA6cv4D3bJg

