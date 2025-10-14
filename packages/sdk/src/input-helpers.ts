import type {
  InputMetadata,
  SelectOption,
  InputValidation,
  ParameterType,
  InputUIType,
} from "./types";

export function createInput(
  type: ParameterType,
  options?: Partial<Omit<InputMetadata, "type">>,
): InputMetadata {
  return {
    type,
    ...options,
  };
}

export function textInput(options?: {
  label?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  validation?: InputValidation;
  multiline?: boolean;
  options?: SelectOption[];
}): InputMetadata {
  return createInput("string", {
    uiType: options?.multiline ? "textarea" : "text",
    ...options,
  });
}

export function numberInput(options?: {
  label?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: number;
  validation?: InputValidation;
  min?: number;
  max?: number;
}): InputMetadata {
  const validation: InputValidation = {
    ...options?.validation,
    min: options?.min ?? options?.validation?.min,
    max: options?.max ?? options?.validation?.max,
  };

  return createInput("number", {
    uiType: "number",
    ...options,
    validation,
  });
}

export function booleanInput(options?: {
  label?: string;
  description?: string;
  defaultValue?: boolean;
}): InputMetadata {
  return createInput("boolean", {
    uiType: "boolean",
    ...options,
  });
}

export function selectInput(
  selectOptions: SelectOption[],
  options?: {
    label?: string;
    description?: string;
    placeholder?: string;
    defaultValue?: string | number;
    validation?: InputValidation;
  },
): InputMetadata {
  return createInput("string", {
    uiType: "select",
    options: selectOptions,
    ...options,
  });
}

export function multiselectInput(
  selectOptions: SelectOption[],
  options?: {
    label?: string;
    description?: string;
    placeholder?: string;
    defaultValue?: (string | number)[];
    validation?: InputValidation;
  },
): InputMetadata {
  return createInput("object", {
    uiType: "multiselect",
    options: selectOptions,
    ...options,
  });
}

export function cronInput(options?: {
  label?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  validation?: InputValidation;
  options?: SelectOption[];
}): InputMetadata {
  return createInput("string", {
    uiType: "textarea",
    placeholder: options?.placeholder ?? "*/10 * * * * *",
    description:
      options?.description ??
      "Cron expression (6 fields: second minute hour day month weekday)",
    ...options,
  });
}

export function urlInput(options?: {
  label?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  validation?: InputValidation;
}): InputMetadata {
  return createInput("string", {
    uiType: "url",
    ...options,
  });
}

export function emailInput(options?: {
  label?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  validation?: InputValidation;
}): InputMetadata {
  return createInput("string", {
    uiType: "email",
    ...options,
  });
}

export function passwordInput(options?: {
  label?: string;
  description?: string;
  placeholder?: string;
  validation?: InputValidation;
}): InputMetadata {
  return createInput("string", {
    uiType: "password",
    ...options,
  });
}

export function dateInput(options?: {
  label?: string;
  description?: string;
  defaultValue?: string;
  validation?: InputValidation;
}): InputMetadata {
  return createInput("string", {
    uiType: "date",
    ...options,
  });
}

export function timeInput(options?: {
  label?: string;
  description?: string;
  defaultValue?: string;
  validation?: InputValidation;
}): InputMetadata {
  return createInput("string", {
    uiType: "time",
    ...options,
  });
}

export function datetimeInput(options?: {
  label?: string;
  description?: string;
  defaultValue?: string;
  validation?: InputValidation;
}): InputMetadata {
  return createInput("string", {
    uiType: "datetime",
    ...options,
  });
}

export function colorInput(options?: {
  label?: string;
  description?: string;
  defaultValue?: string;
  validation?: InputValidation;
}): InputMetadata {
  return createInput("string", {
    uiType: "color",
    ...options,
  });
}

export function jsonInput(options?: {
  label?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  validation?: InputValidation;
}): InputMetadata {
  const validation: InputValidation = {
    ...options?.validation,
    custom: (value: unknown) => {
      const jsonStr = String(value ?? "").trim();
      if (!jsonStr && !options?.validation?.required) {
        return null;
      }

      try {
        JSON.parse(jsonStr);
        return options?.validation?.custom?.(value) ?? null;
      } catch (error) {
        return `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  };

  return createInput("string", {
    uiType: "textarea",
    placeholder: options?.placeholder ?? '{"key": "value"}',
    ...options,
    validation,
  });
}

export function keyValueInput(options?: {
  label?: string;
  description?: string;
  defaultValue?: Record<string, string>;
  validation?: InputValidation;
}): InputMetadata {
  return createInput("object", {
    uiType: "text",
    label: options?.label ?? "Key-Value Pairs",
    description: options?.description ?? "Enter key-value pairs",
    ...options,
  });
}

export function integerInput(options?: {
  label?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: number;
  validation?: InputValidation;
  min?: number;
  max?: number;
  step?: number;
}): InputMetadata {
  const validation: InputValidation = {
    ...options?.validation,
    min: options?.min ?? options?.validation?.min,
    max: options?.max ?? options?.validation?.max,
    custom: (value: unknown) => {
      const num = Number(value);
      if (!Number.isInteger(num)) {
        return "Value must be an integer";
      }
      return options?.validation?.custom?.(value) ?? null;
    },
  };

  return createInput("number", {
    uiType: "number",
    ...options,
    validation,
  });
}
