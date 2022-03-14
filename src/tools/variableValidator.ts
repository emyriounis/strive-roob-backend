const variableValidator = (variable: string, allowedOptions: string[]) =>
  allowedOptions.includes(variable);

export default variableValidator;
