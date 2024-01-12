﻿using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IdentityServer.Migrations.Sqlite.Migrations.UdapDb
{
    /// <inheritdoc />
    public partial class InitialIdentityServerUdapDbMigration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DataProtectionKeys",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    FriendlyName = table.Column<string>(type: "TEXT", nullable: true),
                    Xml = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DataProtectionKeys", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TieredClients",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ClientName = table.Column<string>(type: "TEXT", nullable: false),
                    ClientId = table.Column<string>(type: "TEXT", nullable: false),
                    IdPBaseUrl = table.Column<string>(type: "TEXT", nullable: false),
                    RedirectUri = table.Column<string>(type: "TEXT", nullable: false),
                    ClientUriSan = table.Column<string>(type: "TEXT", nullable: false),
                    CommunityId = table.Column<int>(type: "INTEGER", nullable: false),
                    Enabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    TokenEndpoint = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TieredClients", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UdapCommunities",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Enabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    Default = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UdapCommunities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UdapAnchors",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Enabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    X509Certificate = table.Column<string>(type: "TEXT", nullable: false),
                    Thumbprint = table.Column<string>(type: "TEXT", nullable: false),
                    BeginDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    EndDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CommunityId = table.Column<int>(type: "INTEGER", nullable: false)
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
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    CommunityId = table.Column<int>(type: "INTEGER", nullable: true)
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
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    AnchorId = table.Column<int>(type: "INTEGER", nullable: false),
                    Enabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    X509Certificate = table.Column<string>(type: "TEXT", nullable: false),
                    Thumbprint = table.Column<string>(type: "TEXT", nullable: false),
                    BeginDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    EndDate = table.Column<DateTime>(type: "TEXT", nullable: false)
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
                    AnchorId = table.Column<int>(type: "INTEGER", nullable: false),
                    CertificationId = table.Column<int>(type: "INTEGER", nullable: false)
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
                    CommunityId = table.Column<int>(type: "INTEGER", nullable: false),
                    CertificationId = table.Column<int>(type: "INTEGER", nullable: false)
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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DataProtectionKeys");

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
        }
    }
}
