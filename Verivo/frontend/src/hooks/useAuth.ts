"use client";

import { useContext } from "react";
import { AuthContext } from "@/providers/AuthProvider";

export function useAuth() {
  const context = useContext(AuthContext);

  // Si ce hook est utilise en dehors du AuthProvider, on leve une erreur
  // claire plutot que d'avoir un "Cannot read property of null"
  if (!context) {
    throw new Error("useAuth doit etre utilise a l'interieur d'un AuthProvider");
  }

  return context;
}