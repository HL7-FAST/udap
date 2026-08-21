using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace IdentityServer.Migrations.Pgsql.Migrations.UdapDb
{
    /// <inheritdoc />
    public partial class Update_Duende_v8_0InitialIdentityServerUdapDbMigration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TieredClients");

            migrationBuilder.DropTable(
                name: "UdapAnchorCertification");

            migrationBuilder.DropTable(
                name: "UdapCommunityCertification");

            migrationBuilder.DropTable(
                name: "UdapIntermediateCertificates");

            migrationBuilder.DropTable(
                name: "UdapCertifications");

            migrationBuilder.DropTable(
                name: "UdapAnchors");

            migrationBuilder.DropTable(
                name: "UdapCommunities");

            migrationBuilder.DropPrimaryKey(
                name: "PK_DataProtectionKeys",
                table: "DataProtectionKeys");

            migrationBuilder.EnsureSchema(
                name: "udap");

            migrationBuilder.RenameTable(
                name: "DataProtectionKeys",
                newName: "data_protection_keys",
                newSchema: "udap");

            migrationBuilder.RenameColumn(
                name: "Xml",
                schema: "udap",
                table: "data_protection_keys",
                newName: "xml");

            migrationBuilder.RenameColumn(
                name: "Id",
                schema: "udap",
                table: "data_protection_keys",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "FriendlyName",
                schema: "udap",
                table: "data_protection_keys",
                newName: "friendly_name");

            migrationBuilder.AddPrimaryKey(
                name: "pk_data_protection_keys",
                schema: "udap",
                table: "data_protection_keys",
                column: "id");

            migrationBuilder.CreateTable(
                name: "tiered_clients",
                schema: "udap",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    client_name = table.Column<string>(type: "text", nullable: false),
                    client_id = table.Column<string>(type: "text", nullable: false),
                    id_pbase_url = table.Column<string>(type: "text", nullable: false),
                    redirect_uri = table.Column<string>(type: "text", nullable: false),
                    client_uri_san = table.Column<string>(type: "text", nullable: false),
                    community_id = table.Column<int>(type: "integer", nullable: false),
                    enabled = table.Column<bool>(type: "boolean", nullable: false),
                    token_endpoint = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tiered_clients", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "udap_communities",
                schema: "udap",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    enabled = table.Column<bool>(type: "boolean", nullable: false),
                    @default = table.Column<bool>(name: "default", type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_udap_communities", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "udap_anchors",
                schema: "udap",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    enabled = table.Column<bool>(type: "boolean", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    x509_certificate = table.Column<string>(type: "text", nullable: false),
                    thumbprint = table.Column<string>(type: "text", nullable: false),
                    begin_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    end_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    community_id = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_udap_anchors", x => x.id);
                    table.ForeignKey(
                        name: "fk_anchor_communities",
                        column: x => x.community_id,
                        principalSchema: "udap",
                        principalTable: "udap_communities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "udap_certifications",
                schema: "udap",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    community_id = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_udap_certifications", x => x.id);
                    table.ForeignKey(
                        name: "fk_udap_certifications_udap_communities_community_id",
                        column: x => x.community_id,
                        principalSchema: "udap",
                        principalTable: "udap_communities",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "udap_intermediate_certificates",
                schema: "udap",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    anchor_id = table.Column<int>(type: "integer", nullable: false),
                    enabled = table.Column<bool>(type: "boolean", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    x509_certificate = table.Column<string>(type: "text", nullable: false),
                    thumbprint = table.Column<string>(type: "text", nullable: false),
                    begin_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    end_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_udap_intermediate_certificates", x => x.id);
                    table.ForeignKey(
                        name: "fk_intermediate_certificate_anchor",
                        column: x => x.anchor_id,
                        principalSchema: "udap",
                        principalTable: "udap_anchors",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "udap_anchor_certification",
                schema: "udap",
                columns: table => new
                {
                    anchor_id = table.Column<int>(type: "integer", nullable: false),
                    certification_id = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_udap_anchor_certification", x => new { x.anchor_id, x.certification_id });
                    table.ForeignKey(
                        name: "fk_anchor_certification_anchor",
                        column: x => x.anchor_id,
                        principalSchema: "udap",
                        principalTable: "udap_anchors",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_anchor_certification_certification",
                        column: x => x.certification_id,
                        principalSchema: "udap",
                        principalTable: "udap_certifications",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "udap_community_certification",
                schema: "udap",
                columns: table => new
                {
                    community_id = table.Column<int>(type: "integer", nullable: false),
                    certification_id = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_udap_community_certification", x => new { x.community_id, x.certification_id });
                    table.ForeignKey(
                        name: "fk_community_certification_certification",
                        column: x => x.certification_id,
                        principalSchema: "udap",
                        principalTable: "udap_certifications",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_community_certification_community",
                        column: x => x.community_id,
                        principalSchema: "udap",
                        principalTable: "udap_communities",
                        principalColumn: "id");
                });

            migrationBuilder.CreateIndex(
                name: "ix_udap_anchor_certification_certification_id",
                schema: "udap",
                table: "udap_anchor_certification",
                column: "certification_id");

            migrationBuilder.CreateIndex(
                name: "ix_udap_anchors_community_id",
                schema: "udap",
                table: "udap_anchors",
                column: "community_id");

            migrationBuilder.CreateIndex(
                name: "ix_udap_certifications_community_id",
                schema: "udap",
                table: "udap_certifications",
                column: "community_id");

            migrationBuilder.CreateIndex(
                name: "ix_udap_community_certification_certification_id",
                schema: "udap",
                table: "udap_community_certification",
                column: "certification_id");

            migrationBuilder.CreateIndex(
                name: "ix_udap_intermediate_certificates_anchor_id",
                schema: "udap",
                table: "udap_intermediate_certificates",
                column: "anchor_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "tiered_clients",
                schema: "udap");

            migrationBuilder.DropTable(
                name: "udap_anchor_certification",
                schema: "udap");

            migrationBuilder.DropTable(
                name: "udap_community_certification",
                schema: "udap");

            migrationBuilder.DropTable(
                name: "udap_intermediate_certificates",
                schema: "udap");

            migrationBuilder.DropTable(
                name: "udap_certifications",
                schema: "udap");

            migrationBuilder.DropTable(
                name: "udap_anchors",
                schema: "udap");

            migrationBuilder.DropTable(
                name: "udap_communities",
                schema: "udap");

            migrationBuilder.DropPrimaryKey(
                name: "pk_data_protection_keys",
                schema: "udap",
                table: "data_protection_keys");

            migrationBuilder.RenameTable(
                name: "data_protection_keys",
                schema: "udap",
                newName: "DataProtectionKeys");

            migrationBuilder.RenameColumn(
                name: "xml",
                table: "DataProtectionKeys",
                newName: "Xml");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "DataProtectionKeys",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "friendly_name",
                table: "DataProtectionKeys",
                newName: "FriendlyName");

            migrationBuilder.AddPrimaryKey(
                name: "PK_DataProtectionKeys",
                table: "DataProtectionKeys",
                column: "Id");

            migrationBuilder.CreateTable(
                name: "TieredClients",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ClientId = table.Column<string>(type: "text", nullable: false),
                    ClientName = table.Column<string>(type: "text", nullable: false),
                    ClientUriSan = table.Column<string>(type: "text", nullable: false),
                    CommunityId = table.Column<int>(type: "integer", nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    IdPBaseUrl = table.Column<string>(type: "text", nullable: false),
                    RedirectUri = table.Column<string>(type: "text", nullable: false),
                    TokenEndpoint = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TieredClients", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UdapCommunities",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Default = table.Column<bool>(type: "boolean", nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UdapCommunities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UdapAnchors",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CommunityId = table.Column<int>(type: "integer", nullable: false),
                    BeginDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    EndDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Thumbprint = table.Column<string>(type: "text", nullable: false),
                    X509Certificate = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UdapAnchors", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Anchor_Communities",
                        column: x => x.CommunityId,
                        principalTable: "UdapCommunities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UdapCertifications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CommunityId = table.Column<int>(type: "integer", nullable: true),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UdapCertifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UdapCertifications_UdapCommunities_CommunityId",
                        column: x => x.CommunityId,
                        principalTable: "UdapCommunities",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "UdapIntermediateCertificates",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AnchorId = table.Column<int>(type: "integer", nullable: false),
                    BeginDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    EndDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Thumbprint = table.Column<string>(type: "text", nullable: false),
                    X509Certificate = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UdapIntermediateCertificates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IntermediateCertificate_Anchor",
                        column: x => x.AnchorId,
                        principalTable: "UdapAnchors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UdapAnchorCertification",
                columns: table => new
                {
                    AnchorId = table.Column<int>(type: "integer", nullable: false),
                    CertificationId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UdapAnchorCertification", x => new { x.AnchorId, x.CertificationId });
                    table.ForeignKey(
                        name: "FK_AnchorCertification_Anchor",
                        column: x => x.AnchorId,
                        principalTable: "UdapAnchors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AnchorCertification_Certification",
                        column: x => x.CertificationId,
                        principalTable: "UdapCertifications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UdapCommunityCertification",
                columns: table => new
                {
                    CommunityId = table.Column<int>(type: "integer", nullable: false),
                    CertificationId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UdapCommunityCertification", x => new { x.CommunityId, x.CertificationId });
                    table.ForeignKey(
                        name: "FK_CommunityCertification_Certification",
                        column: x => x.CertificationId,
                        principalTable: "UdapCertifications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CommunityCertification_Community",
                        column: x => x.CommunityId,
                        principalTable: "UdapCommunities",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_UdapAnchorCertification_CertificationId",
                table: "UdapAnchorCertification",
                column: "CertificationId");

            migrationBuilder.CreateIndex(
                name: "IX_UdapAnchors_CommunityId",
                table: "UdapAnchors",
                column: "CommunityId");

            migrationBuilder.CreateIndex(
                name: "IX_UdapCertifications_CommunityId",
                table: "UdapCertifications",
                column: "CommunityId");

            migrationBuilder.CreateIndex(
                name: "IX_UdapCommunityCertification_CertificationId",
                table: "UdapCommunityCertification",
                column: "CertificationId");

            migrationBuilder.CreateIndex(
                name: "IX_UdapIntermediateCertificates_AnchorId",
                table: "UdapIntermediateCertificates",
                column: "AnchorId");
        }
    }
}
