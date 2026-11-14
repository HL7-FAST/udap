using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace IdentityServer.Migrations.Pgsql.Migrations.PersistedGrantDb
{
    /// <inheritdoc />
    public partial class Udap_Npgsql_ContextsInitialIdentityServerPersistedGrantDbMigration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "udap");

            migrationBuilder.CreateTable(
                name: "device_codes",
                schema: "udap",
                columns: table => new
                {
                    user_code = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    device_code = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    subject_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    session_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    client_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    creation_time = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    expiration = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    data = table.Column<string>(type: "character varying(50000)", maxLength: 50000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_device_codes", x => x.user_code);
                });

            migrationBuilder.CreateTable(
                name: "keys",
                schema: "udap",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false),
                    created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    use = table.Column<string>(type: "text", nullable: true),
                    algorithm = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    is_x509_certificate = table.Column<bool>(type: "boolean", nullable: false),
                    data_protected = table.Column<bool>(type: "boolean", nullable: false),
                    data = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_keys", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "persisted_grants",
                schema: "udap",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    key = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    subject_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    session_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    client_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    creation_time = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    expiration = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    consumed_time = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    data = table.Column<string>(type: "character varying(50000)", maxLength: 50000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_persisted_grants", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "pushed_authorization_requests",
                schema: "udap",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    reference_value_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    expires_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    parameters = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pushed_authorization_requests", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "saml_logout_sessions",
                schema: "udap",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    logout_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    serialized_session = table.Column<string>(type: "text", nullable: false),
                    expires_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_saml_logout_sessions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "saml_signin_states",
                schema: "udap",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    state_id = table.Column<Guid>(type: "uuid", nullable: false),
                    serialized_state = table.Column<string>(type: "text", nullable: false),
                    expires_at_utc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    service_provider_entity_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_saml_signin_states", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "server_side_sessions",
                schema: "udap",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    scheme = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    subject_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    session_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    display_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    renewed = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    expires = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    data = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_server_side_sessions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "saml_logout_session_request_indices",
                schema: "udap",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    request_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    saml_logout_session_id = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_saml_logout_session_request_indices", x => x.id);
                    table.ForeignKey(
                        name: "fk_saml_logout_session_request_indices_saml_logout_sessions_sa~",
                        column: x => x.saml_logout_session_id,
                        principalSchema: "udap",
                        principalTable: "saml_logout_sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_device_codes_device_code",
                schema: "udap",
                table: "device_codes",
                column: "device_code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_device_codes_expiration",
                schema: "udap",
                table: "device_codes",
                column: "expiration");

            migrationBuilder.CreateIndex(
                name: "ix_keys_use",
                schema: "udap",
                table: "keys",
                column: "use");

            migrationBuilder.CreateIndex(
                name: "ix_persisted_grants_consumed_time",
                schema: "udap",
                table: "persisted_grants",
                column: "consumed_time");

            migrationBuilder.CreateIndex(
                name: "ix_persisted_grants_expiration",
                schema: "udap",
                table: "persisted_grants",
                column: "expiration");

            migrationBuilder.CreateIndex(
                name: "ix_persisted_grants_key",
                schema: "udap",
                table: "persisted_grants",
                column: "key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_persisted_grants_subject_id_client_id_type",
                schema: "udap",
                table: "persisted_grants",
                columns: new[] { "subject_id", "client_id", "type" });

            migrationBuilder.CreateIndex(
                name: "ix_persisted_grants_subject_id_session_id_type",
                schema: "udap",
                table: "persisted_grants",
                columns: new[] { "subject_id", "session_id", "type" });

            migrationBuilder.CreateIndex(
                name: "ix_pushed_authorization_requests_expires_at_utc",
                schema: "udap",
                table: "pushed_authorization_requests",
                column: "expires_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_pushed_authorization_requests_reference_value_hash",
                schema: "udap",
                table: "pushed_authorization_requests",
                column: "reference_value_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_saml_logout_session_request_indices_request_id",
                schema: "udap",
                table: "saml_logout_session_request_indices",
                column: "request_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_saml_logout_session_request_indices_saml_logout_session_id",
                schema: "udap",
                table: "saml_logout_session_request_indices",
                column: "saml_logout_session_id");

            migrationBuilder.CreateIndex(
                name: "ix_saml_logout_sessions_expires_at_utc",
                schema: "udap",
                table: "saml_logout_sessions",
                column: "expires_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_saml_logout_sessions_logout_id",
                schema: "udap",
                table: "saml_logout_sessions",
                column: "logout_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_saml_signin_states_expires_at_utc",
                schema: "udap",
                table: "saml_signin_states",
                column: "expires_at_utc");

            migrationBuilder.CreateIndex(
                name: "ix_saml_signin_states_state_id",
                schema: "udap",
                table: "saml_signin_states",
                column: "state_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_server_side_sessions_display_name",
                schema: "udap",
                table: "server_side_sessions",
                column: "display_name");

            migrationBuilder.CreateIndex(
                name: "ix_server_side_sessions_expires",
                schema: "udap",
                table: "server_side_sessions",
                column: "expires");

            migrationBuilder.CreateIndex(
                name: "ix_server_side_sessions_key",
                schema: "udap",
                table: "server_side_sessions",
                column: "key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_server_side_sessions_session_id",
                schema: "udap",
                table: "server_side_sessions",
                column: "session_id");

            migrationBuilder.CreateIndex(
                name: "ix_server_side_sessions_subject_id",
                schema: "udap",
                table: "server_side_sessions",
                column: "subject_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "device_codes",
                schema: "udap");

            migrationBuilder.DropTable(
                name: "keys",
                schema: "udap");

            migrationBuilder.DropTable(
                name: "persisted_grants",
                schema: "udap");

            migrationBuilder.DropTable(
                name: "pushed_authorization_requests",
                schema: "udap");

            migrationBuilder.DropTable(
                name: "saml_logout_session_request_indices",
                schema: "udap");

            migrationBuilder.DropTable(
                name: "saml_signin_states",
                schema: "udap");

            migrationBuilder.DropTable(
                name: "server_side_sessions",
                schema: "udap");

            migrationBuilder.DropTable(
                name: "saml_logout_sessions",
                schema: "udap");
        }
    }
}
