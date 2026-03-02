import mongoose from "mongoose";

export const getModel = ({ connection, name, schema, collection }) => {
  const target = connection || mongoose;

  if (target.models?.[name]) {
    return target.models[name];
  }

  return target.model(name, schema, collection);
};
