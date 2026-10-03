import re


def database_configuration(environ, base_dir):
    host = environ.get("POSTGRES_HOST")
    if not host:
        return {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": base_dir / "db.sqlite3",
            "OPTIONS": {"timeout": 30},
        }
    supabase = host.endswith((".supabase.co", ".pooler.supabase.com"))
    schema = environ.get("POSTGRES_SCHEMA", "campustime" if supabase else "public")
    if not re.fullmatch(r"[a-z_][a-z0-9_]{0,62}", schema):
        raise RuntimeError("POSTGRES_SCHEMA must be a lowercase SQL identifier")
    if supabase and schema == "public":
        raise RuntimeError("Supabase requires a private Django schema, e.g. campustime")
    sslmode = environ.get("POSTGRES_SSLMODE", "require" if supabase else "prefer")
    if supabase and sslmode not in {"require", "verify-ca", "verify-full"}:
        raise RuntimeError("Supabase requires an encrypted database connection")
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": environ.get("POSTGRES_DB", "postgres" if supabase else "campuszeit"),
        "USER": environ.get("POSTGRES_USER", "campuszeit"),
        "PASSWORD": environ["POSTGRES_PASSWORD"],
        "HOST": host,
        "PORT": environ.get("POSTGRES_PORT", "5432"),
        # No fallback to public if the requested schema is absent.
        "OPTIONS": {"sslmode": sslmode, "options": f"-c search_path={schema}"},
    }
