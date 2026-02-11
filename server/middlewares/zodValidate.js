export const zodValidate = (schema, source = "body") => {
  return (req, res, next) => {
    const payload = source === "params" ? req.params : req.body;
    const result = schema.safeParse(payload);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      return res.status(400).json({
        error: true,
        success: false,
        code: "INVALID_INPUT",
        message: "Invalid request data",
        details,
      });
    }

    if (source === "params") {
      req.validatedParams = result.data;
    } else {
      req.validatedBody = result.data;
    }

    return next();
  };
};

export const requireValidatedData = (req, res, next) => {
  if (!req.validatedBody && !req.validatedParams) {
    return res.status(400).json({
      error: true,
      success: false,
      code: "INVALID_INPUT",
      message: "Validation missing",
    });
  }
  return next();
};
