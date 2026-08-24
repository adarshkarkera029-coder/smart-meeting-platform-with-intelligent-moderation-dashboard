import React from "react";

export default function AuroraBackdrop({ intense = false }) {
  return (
    <div className={`aurora-backdrop is-global ${intense ? "is-intense" : ""}`} aria-hidden="true">
      <div className="aurora-blob aurora-a" />
      <div className="aurora-blob aurora-b" />
      <div className="aurora-blob aurora-c" />
      <div className="aurora-blob aurora-d" />
      <div className="aurora-veil" />
      <div className="film-grain" />
    </div>
  );
}
