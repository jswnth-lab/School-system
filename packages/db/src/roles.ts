import { pgRole } from "drizzle-orm/pg-core";

// Created outside migrations (has a password).
export const appUser = pgRole("app_user").existing();
