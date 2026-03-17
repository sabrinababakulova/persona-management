--
-- PostgreSQL database dump
--

\restrict fx7W7yaokigMAzxyUhbsMlAu6khoOSgFfNIMxHmanhpLa6vA3f4b3tadMbDsf3M

-- Dumped from database version 18.1 (Debian 18.1-1.pgdg13+2)
-- Dumped by pg_dump version 18.1 (Homebrew)

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
34fbf4e6-49f2-46ad-8d8a-834a576508b0	\N	\N	abf8a154-5b1c-4a46-ac9c-7300570f4f17	1
21c4011c-5c79-413b-bfd0-f660519d1cdd	e8c3bdc9-801c-483b-8c89-451440d14e16	\N	68572490-eaca-4763-80d7-4b3fbac5861b	\N
\.


--
-- Data for Name: directus_activity; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_activity (id, action, "user", "timestamp", ip, user_agent, collection, item, origin) FROM stdin;
1	login	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:24:21.46+00	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	directus_users	3b27f7b7-7d94-4452-843a-e09c3b35bba0	http://localhost:8055
2	update	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:24:32.799+00	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	directus_settings	1	http://localhost:8055
3	login	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:35:59.067+00	192.168.65.1	curl/8.7.1	directus_users	3b27f7b7-7d94-4452-843a-e09c3b35bba0	\N
4	login	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:36:07.23+00	192.168.65.1	curl/8.7.1	directus_users	3b27f7b7-7d94-4452-843a-e09c3b35bba0	\N
5	login	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:36:17.561+00	192.168.65.1	curl/8.7.1	directus_users	3b27f7b7-7d94-4452-843a-e09c3b35bba0	\N
6	login	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:36:44.079+00	192.168.65.1	curl/8.7.1	directus_users	3b27f7b7-7d94-4452-843a-e09c3b35bba0	\N
7	create	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:36:44.638+00	192.168.65.1	curl/8.7.1	directus_collections	account	\N
8	create	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:36:44.685+00	192.168.65.1	curl/8.7.1	directus_collections	candidate	\N
9	create	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:36:44.756+00	192.168.65.1	curl/8.7.1	directus_collections	candidate_contact_type	\N
10	create	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:36:44.787+00	192.168.65.1	curl/8.7.1	directus_collections	candidate_language	\N
11	create	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:36:44.816+00	192.168.65.1	curl/8.7.1	directus_collections	candidate_language_level	\N
12	create	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:36:44.844+00	192.168.65.1	curl/8.7.1	directus_collections	candidate_position	\N
13	create	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:36:44.872+00	192.168.65.1	curl/8.7.1	directus_collections	candidate_skill	\N
14	create	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:36:44.899+00	192.168.65.1	curl/8.7.1	directus_collections	candidate_source	\N
15	create	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:36:44.927+00	192.168.65.1	curl/8.7.1	directus_collections	candidate_status_option	\N
16	create	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:36:44.955+00	192.168.65.1	curl/8.7.1	directus_collections	post	\N
17	create	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:36:45.003+00	192.168.65.1	curl/8.7.1	directus_collections	recent_activity_log	\N
18	create	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:36:45.031+00	192.168.65.1	curl/8.7.1	directus_collections	session	\N
19	create	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:36:45.06+00	192.168.65.1	curl/8.7.1	directus_collections	user	\N
20	create	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:36:45.087+00	192.168.65.1	curl/8.7.1	directus_collections	vacancy	\N
21	create	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:36:45.113+00	192.168.65.1	curl/8.7.1	directus_collections	vacancy_level_option	\N
22	create	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:36:45.143+00	192.168.65.1	curl/8.7.1	directus_collections	vacancy_status_option	\N
23	create	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:36:45.177+00	192.168.65.1	curl/8.7.1	directus_collections	vacancy_work_type_option	\N
24	create	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:36:45.206+00	192.168.65.1	curl/8.7.1	directus_collections	verification_token	\N
\.


--
-- Data for Name: directus_collections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_collections (collection, icon, note, display_template, hidden, singleton, translations, archive_field, archive_app_filter, archive_value, unarchive_value, sort_field, accountability, color, item_duplication_fields, sort, "group", collapse, preview_url, versioning) FROM stdin;
account	\N	\N	\N	f	f	\N	\N	t	\N	\N	\N	all	\N	\N	\N	\N	open	\N	f
candidate	\N	\N	\N	f	f	\N	\N	t	\N	\N	\N	all	\N	\N	\N	\N	open	\N	f
candidate_contact_type	\N	\N	\N	f	f	\N	\N	t	\N	\N	\N	all	\N	\N	\N	\N	open	\N	f
candidate_language	\N	\N	\N	f	f	\N	\N	t	\N	\N	\N	all	\N	\N	\N	\N	open	\N	f
candidate_language_level	\N	\N	\N	f	f	\N	\N	t	\N	\N	\N	all	\N	\N	\N	\N	open	\N	f
candidate_position	\N	\N	\N	f	f	\N	\N	t	\N	\N	\N	all	\N	\N	\N	\N	open	\N	f
candidate_skill	\N	\N	\N	f	f	\N	\N	t	\N	\N	\N	all	\N	\N	\N	\N	open	\N	f
candidate_source	\N	\N	\N	f	f	\N	\N	t	\N	\N	\N	all	\N	\N	\N	\N	open	\N	f
candidate_status_option	\N	\N	\N	f	f	\N	\N	t	\N	\N	\N	all	\N	\N	\N	\N	open	\N	f
post	\N	\N	\N	f	f	\N	\N	t	\N	\N	\N	all	\N	\N	\N	\N	open	\N	f
recent_activity_log	\N	\N	\N	f	f	\N	\N	t	\N	\N	\N	all	\N	\N	\N	\N	open	\N	f
session	\N	\N	\N	f	f	\N	\N	t	\N	\N	\N	all	\N	\N	\N	\N	open	\N	f
user	\N	\N	\N	f	f	\N	\N	t	\N	\N	\N	all	\N	\N	\N	\N	open	\N	f
vacancy	\N	\N	\N	f	f	\N	\N	t	\N	\N	\N	all	\N	\N	\N	\N	open	\N	f
vacancy_level_option	\N	\N	\N	f	f	\N	\N	t	\N	\N	\N	all	\N	\N	\N	\N	open	\N	f
vacancy_status_option	\N	\N	\N	f	f	\N	\N	t	\N	\N	\N	all	\N	\N	\N	\N	open	\N	f
vacancy_work_type_option	\N	\N	\N	f	f	\N	\N	t	\N	\N	\N	all	\N	\N	\N	\N	open	\N	f
verification_token	\N	\N	\N	f	f	\N	\N	t	\N	\N	\N	all	\N	\N	\N	\N	open	\N	f
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
20201028A	Remove Collection Foreign Keys	2026-03-17 06:23:19.667853+00
20201029A	Remove System Relations	2026-03-17 06:23:19.683235+00
20201029B	Remove System Collections	2026-03-17 06:23:19.691454+00
20201029C	Remove System Fields	2026-03-17 06:23:19.700173+00
20201105A	Add Cascade System Relations	2026-03-17 06:23:19.737865+00
20201105B	Change Webhook URL Type	2026-03-17 06:23:19.745053+00
20210225A	Add Relations Sort Field	2026-03-17 06:23:19.748311+00
20210304A	Remove Locked Fields	2026-03-17 06:23:19.751404+00
20210312A	Webhooks Collections Text	2026-03-17 06:23:19.756256+00
20210331A	Add Refresh Interval	2026-03-17 06:23:19.759521+00
20210415A	Make Filesize Nullable	2026-03-17 06:23:19.764908+00
20210416A	Add Collections Accountability	2026-03-17 06:23:19.767118+00
20210422A	Remove Files Interface	2026-03-17 06:23:19.768504+00
20210506A	Rename Interfaces	2026-03-17 06:23:19.787143+00
20210510A	Restructure Relations	2026-03-17 06:23:19.79511+00
20210518A	Add Foreign Key Constraints	2026-03-17 06:23:19.800221+00
20210519A	Add System Fk Triggers	2026-03-17 06:23:19.814037+00
20210521A	Add Collections Icon Color	2026-03-17 06:23:19.815467+00
20210525A	Add Insights	2026-03-17 06:23:19.822169+00
20210608A	Add Deep Clone Config	2026-03-17 06:23:19.823771+00
20210626A	Change Filesize Bigint	2026-03-17 06:23:19.839803+00
20210716A	Add Conditions to Fields	2026-03-17 06:23:19.842014+00
20210721A	Add Default Folder	2026-03-17 06:23:19.845857+00
20210802A	Replace Groups	2026-03-17 06:23:19.848477+00
20210803A	Add Required to Fields	2026-03-17 06:23:19.852532+00
20210805A	Update Groups	2026-03-17 06:23:19.854876+00
20210805B	Change Image Metadata Structure	2026-03-17 06:23:19.85757+00
20210811A	Add Geometry Config	2026-03-17 06:23:19.860379+00
20210831A	Remove Limit Column	2026-03-17 06:23:19.862182+00
20210903A	Add Auth Provider	2026-03-17 06:23:19.869919+00
20210907A	Webhooks Collections Not Null	2026-03-17 06:23:19.873716+00
20210910A	Move Module Setup	2026-03-17 06:23:19.876033+00
20210920A	Webhooks URL Not Null	2026-03-17 06:23:19.880321+00
20210924A	Add Collection Organization	2026-03-17 06:23:19.883019+00
20210927A	Replace Fields Group	2026-03-17 06:23:19.887521+00
20210927B	Replace M2M Interface	2026-03-17 06:23:19.888597+00
20210929A	Rename Login Action	2026-03-17 06:23:19.889864+00
20211007A	Update Presets	2026-03-17 06:23:19.893998+00
20211009A	Add Auth Data	2026-03-17 06:23:19.895403+00
20211016A	Add Webhook Headers	2026-03-17 06:23:19.896517+00
20211103A	Set Unique to User Token	2026-03-17 06:23:19.898082+00
20211103B	Update Special Geometry	2026-03-17 06:23:19.899362+00
20211104A	Remove Collections Listing	2026-03-17 06:23:19.90052+00
20211118A	Add Notifications	2026-03-17 06:23:19.908533+00
20211211A	Add Shares	2026-03-17 06:23:19.918851+00
20211230A	Add Project Descriptor	2026-03-17 06:23:19.92082+00
20220303A	Remove Default Project Color	2026-03-17 06:23:19.929485+00
20220308A	Add Bookmark Icon and Color	2026-03-17 06:23:19.941243+00
20220314A	Add Translation Strings	2026-03-17 06:23:19.943334+00
20220322A	Rename Field Typecast Flags	2026-03-17 06:23:19.946944+00
20220323A	Add Field Validation	2026-03-17 06:23:19.948237+00
20220325A	Fix Typecast Flags	2026-03-17 06:23:19.950357+00
20220325B	Add Default Language	2026-03-17 06:23:19.954485+00
20220402A	Remove Default Value Panel Icon	2026-03-17 06:23:19.957792+00
20220429A	Add Flows	2026-03-17 06:23:19.976268+00
20220429B	Add Color to Insights Icon	2026-03-17 06:23:19.979362+00
20220429C	Drop Non Null From IP of Activity	2026-03-17 06:23:19.981308+00
20220429D	Drop Non Null From Sender of Notifications	2026-03-17 06:23:19.98258+00
20220614A	Rename Hook Trigger to Event	2026-03-17 06:23:19.983907+00
20220801A	Update Notifications Timestamp Column	2026-03-17 06:23:19.987345+00
20220802A	Add Custom Aspect Ratios	2026-03-17 06:23:19.988902+00
20220826A	Add Origin to Accountability	2026-03-17 06:23:19.991132+00
20230401A	Update Material Icons	2026-03-17 06:23:19.997064+00
20230525A	Add Preview Settings	2026-03-17 06:23:19.998413+00
20230526A	Migrate Translation Strings	2026-03-17 06:23:20.00246+00
20230721A	Require Shares Fields	2026-03-17 06:23:20.004803+00
20230823A	Add Content Versioning	2026-03-17 06:23:20.014569+00
20230927A	Themes	2026-03-17 06:23:20.033669+00
20231009A	Update CSV Fields to Text	2026-03-17 06:23:20.037309+00
20231009B	Update Panel Options	2026-03-17 06:23:20.038601+00
20231010A	Add Extensions	2026-03-17 06:23:20.040243+00
20231215A	Add Focalpoints	2026-03-17 06:23:20.041532+00
20240122A	Add Report URL Fields	2026-03-17 06:23:20.042754+00
20240204A	Marketplace	2026-03-17 06:23:20.055572+00
20240305A	Change Useragent Type	2026-03-17 06:23:20.06269+00
20240311A	Deprecate Webhooks	2026-03-17 06:23:20.069301+00
20240422A	Public Registration	2026-03-17 06:23:20.073806+00
20240515A	Add Session Window	2026-03-17 06:23:20.075289+00
20240701A	Add Tus Data	2026-03-17 06:23:20.07811+00
20240716A	Update Files Date Fields	2026-03-17 06:23:20.083766+00
20240806A	Permissions Policies	2026-03-17 06:23:20.107746+00
20240817A	Update Icon Fields Length	2026-03-17 06:23:20.123806+00
20240909A	Separate Comments	2026-03-17 06:23:20.144068+00
20240909B	Consolidate Content Versioning	2026-03-17 06:23:20.145583+00
20240924A	Migrate Legacy Comments	2026-03-17 06:23:20.148959+00
20240924B	Populate Versioning Deltas	2026-03-17 06:23:20.151489+00
20250224A	Visual Editor	2026-03-17 06:23:20.153343+00
20250609A	License Banner	2026-03-17 06:23:20.15525+00
20250613A	Add Project ID	2026-03-17 06:23:20.161808+00
20250718A	Add Direction	2026-03-17 06:23:20.163509+00
20250813A	Add MCP	2026-03-17 06:23:20.166031+00
20251012A	Add Field Searchable	2026-03-17 06:23:20.16729+00
20251014A	Add Project Owner	2026-03-17 06:23:20.190787+00
20251028A	Add Retention Indexes	2026-03-17 06:23:20.235222+00
20251103A	Add AI Settings	2026-03-17 06:23:20.236895+00
20251224A	Remove Webhooks	2026-03-17 06:23:20.240374+00
20260110A	Add AI Provider Settings	2026-03-17 06:23:20.243238+00
20260113A	Add Revisions Index	2026-03-17 06:23:20.252013+00
20260128A	Add Collaborative Editing	2026-03-17 06:23:20.253673+00
20260204A	Add Deployment	2026-03-17 06:23:20.268888+00
20260211A	Add Deployment Webhooks	2026-03-17 06:23:20.271677+00
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
68572490-eaca-4763-80d7-4b3fbac5861b	Administrator	verified	$t:admin_description	\N	f	t	t
\.


--
-- Data for Name: directus_presets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_presets (id, bookmark, "user", role, collection, search, layout, layout_query, layout_options, refresh_interval, filter, icon, color) FROM stdin;
2	\N	3b27f7b7-7d94-4452-843a-e09c3b35bba0	\N	candidate	\N	\N	{"tabular":{"page":1}}	\N	\N	\N	bookmark	\N
3	\N	3b27f7b7-7d94-4452-843a-e09c3b35bba0	\N	account	\N	\N	{"tabular":{"page":1}}	\N	\N	\N	bookmark	\N
1	\N	3b27f7b7-7d94-4452-843a-e09c3b35bba0	\N	candidate_language	\N	\N	{"tabular":{"page":1}}	\N	\N	\N	bookmark	\N
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
1	2	directus_settings	1	{"id":1,"project_name":"Directus","project_url":null,"project_color":"#6644FF","project_logo":null,"public_foreground":null,"public_background":null,"public_note":null,"auth_login_attempts":25,"auth_password_policy":null,"storage_asset_transform":"all","storage_asset_presets":null,"custom_css":null,"storage_default_folder":null,"basemaps":null,"mapbox_key":null,"module_bar":null,"project_descriptor":null,"default_language":"en-US","custom_aspect_ratios":null,"public_favicon":null,"default_appearance":"auto","default_theme_light":null,"theme_light_overrides":null,"default_theme_dark":null,"theme_dark_overrides":null,"report_error_url":null,"report_bug_url":null,"report_feature_url":null,"public_registration":false,"public_registration_verify_email":true,"public_registration_role":null,"public_registration_email_filter":null,"visual_editor_urls":null,"project_id":"019cfa76-9060-745b-a77a-3d66a4fec9a2","mcp_enabled":false,"mcp_allow_deletes":false,"mcp_prompts_collection":null,"mcp_system_prompt_enabled":true,"mcp_system_prompt":null,"project_owner":"sabrina.babakulova@gmail.com","project_usage":"personal","org_name":null,"product_updates":false,"project_status":null,"ai_openai_api_key":null,"ai_anthropic_api_key":null,"ai_system_prompt":null,"ai_google_api_key":null,"ai_openai_compatible_api_key":null,"ai_openai_compatible_base_url":null,"ai_openai_compatible_name":null,"ai_openai_compatible_models":null,"ai_openai_compatible_headers":null,"ai_openai_allowed_models":["gpt-5-nano","gpt-5-mini","gpt-5"],"ai_anthropic_allowed_models":["claude-haiku-4-5","claude-sonnet-4-5"],"ai_google_allowed_models":["gemini-3-pro-preview","gemini-3-flash-preview","gemini-2.5-pro","gemini-2.5-flash"],"collaborative_editing_enabled":false}	{"project_owner":"sabrina.babakulova@gmail.com","project_usage":"personal","org_name":null,"product_updates":false,"project_status":null}	\N	\N
2	7	directus_collections	account	{"hidden":false,"singleton":false,"collection":"account"}	{"hidden":false,"singleton":false,"collection":"account"}	\N	\N
3	8	directus_collections	candidate	{"hidden":false,"singleton":false,"collection":"candidate"}	{"hidden":false,"singleton":false,"collection":"candidate"}	\N	\N
4	9	directus_collections	candidate_contact_type	{"hidden":false,"singleton":false,"collection":"candidate_contact_type"}	{"hidden":false,"singleton":false,"collection":"candidate_contact_type"}	\N	\N
5	10	directus_collections	candidate_language	{"hidden":false,"singleton":false,"collection":"candidate_language"}	{"hidden":false,"singleton":false,"collection":"candidate_language"}	\N	\N
6	11	directus_collections	candidate_language_level	{"hidden":false,"singleton":false,"collection":"candidate_language_level"}	{"hidden":false,"singleton":false,"collection":"candidate_language_level"}	\N	\N
7	12	directus_collections	candidate_position	{"hidden":false,"singleton":false,"collection":"candidate_position"}	{"hidden":false,"singleton":false,"collection":"candidate_position"}	\N	\N
8	13	directus_collections	candidate_skill	{"hidden":false,"singleton":false,"collection":"candidate_skill"}	{"hidden":false,"singleton":false,"collection":"candidate_skill"}	\N	\N
9	14	directus_collections	candidate_source	{"hidden":false,"singleton":false,"collection":"candidate_source"}	{"hidden":false,"singleton":false,"collection":"candidate_source"}	\N	\N
10	15	directus_collections	candidate_status_option	{"hidden":false,"singleton":false,"collection":"candidate_status_option"}	{"hidden":false,"singleton":false,"collection":"candidate_status_option"}	\N	\N
11	16	directus_collections	post	{"hidden":false,"singleton":false,"collection":"post"}	{"hidden":false,"singleton":false,"collection":"post"}	\N	\N
12	17	directus_collections	recent_activity_log	{"hidden":false,"singleton":false,"collection":"recent_activity_log"}	{"hidden":false,"singleton":false,"collection":"recent_activity_log"}	\N	\N
13	18	directus_collections	session	{"hidden":false,"singleton":false,"collection":"session"}	{"hidden":false,"singleton":false,"collection":"session"}	\N	\N
14	19	directus_collections	user	{"hidden":false,"singleton":false,"collection":"user"}	{"hidden":false,"singleton":false,"collection":"user"}	\N	\N
15	20	directus_collections	vacancy	{"hidden":false,"singleton":false,"collection":"vacancy"}	{"hidden":false,"singleton":false,"collection":"vacancy"}	\N	\N
16	21	directus_collections	vacancy_level_option	{"hidden":false,"singleton":false,"collection":"vacancy_level_option"}	{"hidden":false,"singleton":false,"collection":"vacancy_level_option"}	\N	\N
17	22	directus_collections	vacancy_status_option	{"hidden":false,"singleton":false,"collection":"vacancy_status_option"}	{"hidden":false,"singleton":false,"collection":"vacancy_status_option"}	\N	\N
18	23	directus_collections	vacancy_work_type_option	{"hidden":false,"singleton":false,"collection":"vacancy_work_type_option"}	{"hidden":false,"singleton":false,"collection":"vacancy_work_type_option"}	\N	\N
19	24	directus_collections	verification_token	{"hidden":false,"singleton":false,"collection":"verification_token"}	{"hidden":false,"singleton":false,"collection":"verification_token"}	\N	\N
\.


--
-- Data for Name: directus_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_roles (id, name, icon, description, parent) FROM stdin;
e8c3bdc9-801c-483b-8c89-451440d14e16	Administrator	verified	$t:admin_description	\N
\.


--
-- Data for Name: directus_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_sessions (token, "user", expires, ip, user_agent, share, origin, next_token) FROM stdin;
Bcc2qPxTe9mzf9HErgArtkj2nSEEFO_zQdxn43n9Ac_ejx_i2jBEPXaTdoS2O5bM	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-24 06:35:59.063+00	192.168.65.1	curl/8.7.1	\N	\N	\N
gpZXxVcveovGixVN6UMhAI5-RtyxBFHx1p-j7__JKAmcnk3ErEgiy4qj4Ag89sbh	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-24 06:36:07.226+00	192.168.65.1	curl/8.7.1	\N	\N	\N
geE6_W8uE41g1vKbh5CiW7pb94DV8ROLs-6n3lbpJ-VwE00-8CwUxWxmhq9CaVPd	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-24 06:36:17.558+00	192.168.65.1	curl/8.7.1	\N	\N	\N
S0AorS7pGEB-srLp1KZqpk-IIyc1cXzo51Nf_EpHS9C3rZ6nj3rJ1Nb5Jse63ACv	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-24 06:36:44.076+00	192.168.65.1	curl/8.7.1	\N	\N	\N
N51yKZrtdvn_Eq6q84R4XTEsYCM7uE9ACpBcPfWOzDkQtykmyKe2GW3phYhAsFHw	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-17 06:37:18.477+00	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	\N	http://localhost:8055	RywoV4zHezoCHF_qFi0AViZX1Sd5D_S1_grb231lm4lQy5hElDewrw-Vb2kLVZfC
RywoV4zHezoCHF_qFi0AViZX1Sd5D_S1_grb231lm4lQy5hElDewrw-Vb2kLVZfC	3b27f7b7-7d94-4452-843a-e09c3b35bba0	2026-03-18 06:37:08.477+00	192.168.65.1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	\N	http://localhost:8055	\N
\.


--
-- Data for Name: directus_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_settings (id, project_name, project_url, project_color, project_logo, public_foreground, public_background, public_note, auth_login_attempts, auth_password_policy, storage_asset_transform, storage_asset_presets, custom_css, storage_default_folder, basemaps, mapbox_key, module_bar, project_descriptor, default_language, custom_aspect_ratios, public_favicon, default_appearance, default_theme_light, theme_light_overrides, default_theme_dark, theme_dark_overrides, report_error_url, report_bug_url, report_feature_url, public_registration, public_registration_verify_email, public_registration_role, public_registration_email_filter, visual_editor_urls, project_id, mcp_enabled, mcp_allow_deletes, mcp_prompts_collection, mcp_system_prompt_enabled, mcp_system_prompt, project_owner, project_usage, org_name, product_updates, project_status, ai_openai_api_key, ai_anthropic_api_key, ai_system_prompt, ai_google_api_key, ai_openai_compatible_api_key, ai_openai_compatible_base_url, ai_openai_compatible_name, ai_openai_compatible_models, ai_openai_compatible_headers, ai_openai_allowed_models, ai_anthropic_allowed_models, ai_google_allowed_models, collaborative_editing_enabled) FROM stdin;
1	Directus	\N	#6644FF	\N	\N	\N	\N	25	\N	all	\N	\N	\N	\N	\N	\N	\N	en-US	\N	\N	auto	\N	\N	\N	\N	\N	\N	\N	f	t	\N	\N	\N	019cfa76-9060-745b-a77a-3d66a4fec9a2	f	f	\N	t	\N	sabrina.babakulova@gmail.com	personal	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	["gpt-5-nano","gpt-5-mini","gpt-5"]	["claude-haiku-4-5","claude-sonnet-4-5"]	["gemini-3-pro-preview","gemini-3-flash-preview","gemini-2.5-pro","gemini-2.5-flash"]	f
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
3b27f7b7-7d94-4452-843a-e09c3b35bba0	Admin	User	admin@example.com	$argon2id$v=19$m=65536,t=3,p=4$qgvDqc47mMwnjTLY98xaYA$LULhonwXH1T4fxeJ3t2UuHeNbU0I5mCtQFuzitTnjt4	\N	\N	\N	\N	\N	\N	\N	active	e8c3bdc9-801c-483b-8c89-451440d14e16	\N	2026-03-17 06:37:08.484+00	/content/candidate_language_level	default	\N	\N	t	\N	\N	\N	\N	\N	auto
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
\.


--
-- Name: directus_activity_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_activity_id_seq', 24, true);


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

SELECT pg_catalog.setval('public.directus_presets_id_seq', 3, true);


--
-- Name: directus_relations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_relations_id_seq', 1, false);


--
-- Name: directus_revisions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_revisions_id_seq', 19, true);


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
-- PostgreSQL database dump complete
--

\unrestrict fx7W7yaokigMAzxyUhbsMlAu6khoOSgFfNIMxHmanhpLa6vA3f4b3tadMbDsf3M

