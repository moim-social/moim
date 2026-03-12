CREATE TABLE "countries" (
	"code" varchar(2) PRIMARY KEY NOT NULL,
	"alpha3" varchar(3) NOT NULL,
	"name" varchar(200) NOT NULL,
	"geometry" jsonb NOT NULL,
	"bbox" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
