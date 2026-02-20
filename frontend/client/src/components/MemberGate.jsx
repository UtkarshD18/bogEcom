"use client";

const MemberGate = ({ isMember, fallback = null, children }) => {
  if (!!isMember) {
    return children;
  }
  return fallback ?? null;
};

export default MemberGate;
