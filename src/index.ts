/**
 * flex-dto - Flexible DTO mapper for frontend
 *
 * snake_case/camelCase conversion with class instantiation.
 * Zero dependencies.
 *
 * @example Basic usage
 * ```typescript
 * class User extends FlexDto {
 *   userId = '';
 *   userName = '';
 *
 *   constructor(data: User) {
 *     super();
 *     this.init(data);
 *   }
 * }
 *
 * // Works with snake_case
 * const user = new User({ user_id: 'U001', user_name: 'John' });
 *
 * // Works with camelCase
 * const user2 = new User({ userId: 'U002', userName: 'Jane' });
 * ```
 *
 * @example With nested DTO (type-safe transforms)
 * ```typescript
 * class Center extends FlexDto {
 *   centerId = '';
 *   centerName = '';
 *
 *   constructor(data: Center) {
 *     super();
 *     this.init(data);
 *   }
 * }
 *
 * class User extends FlexDto {
 *   userId = '';
 *   center: Center | null = null;
 *
 *   constructor(data: User) {
 *     super();
 *     this.init(data, {
 *       transforms: {
 *         center: (v) => v ? new Center(v) : null  // 타입 자동 추론!
 *       }
 *     });
 *   }
 * }
 * ```
 */

// ============================================================================
// Metadata Storage (for decorators)
// ============================================================================

const aliasMetadata = new WeakMap<object, Record<string, string[]>>();
const transformMetadata = new WeakMap<object, Record<string, TransformFn>>();

function getAliases(target: object): Record<string, string[]> {
  return aliasMetadata.get(target.constructor.prototype) || {};
}

function getTransforms(target: object): Record<string, TransformFn> {
  return transformMetadata.get(target.constructor.prototype) || {};
}

// ============================================================================
// Decorators
// ============================================================================

/**
 * Define field aliases for mapping from different key names
 * @example
 * @Alias('cen_id', 'cenId')
 * centerId = '';
 */
export function Alias(...aliases: string[]) {
  return function (target: object, propertyKey: string) {
    const proto = target.constructor.prototype;
    const existing = aliasMetadata.get(proto) || {};
    existing[propertyKey] = aliases;
    aliasMetadata.set(proto, existing);
  };
}

/**
 * Define transform function for field value conversion
 * @example
 * @Transform(Number)
 * amount = 0;
 *
 * @Transform((v) => new Date(v))
 * createdAt = new Date();
 */
export function Transform(fn: TransformFn) {
  return function (target: object, propertyKey: string) {
    const proto = target.constructor.prototype;
    const existing = transformMetadata.get(proto) || {};
    existing[propertyKey] = fn;
    transformMetadata.set(proto, existing);
  };
}

// ============================================================================
// Utility
// ============================================================================

function toSnakeCase(str: string): string {
  if (!str) return str;
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const isUpper = char === char.toUpperCase() && char !== char.toLowerCase();

    if (isUpper) {
      const prevChar = i > 0 ? str[i - 1] : "";
      const nextChar = i < str.length - 1 ? str[i + 1] : "";
      const prevIsUpper =
        prevChar && prevChar === prevChar.toUpperCase() && prevChar !== prevChar.toLowerCase();
      const nextIsLower =
        nextChar && nextChar === nextChar.toLowerCase() && nextChar !== nextChar.toUpperCase();

      if (i > 0 && (!prevIsUpper || (prevIsUpper && nextIsLower))) {
        result += "_";
      }
      result += char.toLowerCase();
    } else {
      result += char;
    }
  }
  return result;
}

function toCamelCase(str: string): string {
  if (!str) return str;
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// ============================================================================
// Types
// ============================================================================

type TransformFn = (value: unknown) => unknown;

/**
 * Extract the type that a transform function returns
 */
type TransformReturnType<T> = T extends (value: unknown) => infer R ? R : never;

/**
 * Type-safe transforms configuration
 * - Input is `any` for flexibility (API responses have unknown shapes)
 * - Return type must match the field type exactly
 *
 * @example
 * ```typescript
 * class User extends FlexDto {
 *   center: Center | null = null;
 *
 *   constructor(data?: User) {
 *     const transforms: Transforms<User> = {
 *       // v is `any` - flexible input from API
 *       // return type must be Center | null
 *       center: (v) => v ? new Center(v) : null
 *     };
 *     super({ transforms });
 *   }
 * }
 * ```
 */
export type Transforms<T> = {
  [K in keyof T]?: (value: any) => T[K];
};

/**
 * Detect if we're in development mode
 * Checks NODE_ENV or process.env.NODE_ENV
 *
 * Returns true if:
 * - NODE_ENV === "development"
 * - window.__FLEX_DTO_STRICT__ === true (browser environments)
 *
 * Returns false otherwise (production mode or not set)
 */
function isDevelopmentMode(): boolean {
  try {
    // Check Node.js environment (use try-catch to avoid type errors)
    const globalProcess = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process;
    if (globalProcess?.env?.NODE_ENV === "development") {
      return true;
    }
  } catch {
    // Ignore errors in environments without process
  }

  // For browser environments, check if we're in development
  // You can set window.__FLEX_DTO_STRICT__ = true in development
  try {
    if (typeof globalThis !== "undefined") {
      const windowObj = globalThis as {
        __FLEX_DTO_STRICT__?: boolean;
        window?: { __FLEX_DTO_STRICT__?: boolean };
      };
      if (
        windowObj.__FLEX_DTO_STRICT__ === true ||
        windowObj.window?.__FLEX_DTO_STRICT__ === true
      ) {
        return true;
      }
    }
  } catch {
    // Ignore errors
  }

  return false;
}

export interface FlexDtoOptions<T> {
  /** Custom aliases for field mapping */
  aliases?: Record<string, string[]>;
  /**
   * Transform functions for field values
   * Type-safe: return type must match the field type
   *
   * @example
   * ```typescript
   * class User extends FlexDto {
   *   center: Center | null = null;
   *
   *   constructor(data: User) {
   *     super();
   *     this.init(data, {
   *       transforms: {
   *         center: (v) => v ? new Center(v) : null
   *       }
   *     });
   *   }
   * }
   * ```
   */
  transforms?: Transforms<T>;
  /**
   * Strict mode: warn about type mismatches in development
   * - true: Warn in development when types don't match (never throws errors)
   * - false: Never warn
   * - undefined: Auto-detect from environment (development = true, production = false)
   *
   * **Behavior**:
   * - Type matches: No warning, value used as-is
   * - Type mismatch + no transform: Warning shown, original value used
   * - Transform provided: No type validation, transform applied
   * - Transform fails: Warning shown, original value used
   * - No initial value: Type validation skipped, value used as-is
   *
   * **Note**: In production, errors are never thrown to prevent process crashes.
   * Only warnings are shown in development mode.
   */
  strictMode?: boolean;
}

// Internal options type (uses Record for runtime)
interface InternalOptions {
  aliases?: Record<string, string[]>;
  transforms?: Record<string, TransformFn>;
  strictMode?: boolean;
}

// ============================================================================
// FlexDto
// ============================================================================

export class FlexDto {
  [key: string]: unknown;
  private _opts: InternalOptions = {};
  private _strictMode?: boolean;

  constructor() {
    // Auto-detect strict mode from environment
    this._strictMode = isDevelopmentMode();
  }

  /**
   * Validate type compatibility
   * In development mode, warns about type mismatches
   * Only warns - does not convert values
   */
  private validateType(key: string, value: unknown, expectedType: string): void {
    const strictMode = this._opts.strictMode ?? this._strictMode;
    if (!strictMode) return;

    const actualType = typeof value;
    const isCompatible =
      actualType === expectedType ||
      (expectedType === "object" &&
        (actualType === "object" || actualType === "undefined" || value === null));

    if (!isCompatible) {
      const className = this.constructor.name;
      const isDev = isDevelopmentMode();

      if (isDev) {
        // In development, warn about type mismatch
        console.warn(
          `[flex-dto] Type mismatch in ${className}.${key}: ` +
            `Expected ${expectedType}, but got ${actualType} (value: ${JSON.stringify(value)}). ` +
            `Use @Transform decorator or transforms option to handle type conversion. Set strictMode: false to disable warnings.`
        );
      }
    }
  }

  /**
   * Get class field names (including inherited fields)
   * Returns all property names defined in the class hierarchy
   * Since TypeScript class fields are instance properties, we check:
   * 1. Current instance properties (initialized fields)
   * 2. Prototype chain for any additional fields
   *
   * Note: Fields without initial values won't exist at runtime until assigned,
   * so we allow assignment to any camelCase field name that matches the pattern.
   */
  private getClassFields(): Set<string> {
    const fields = new Set<string>();

    // Get fields from current instance (TypeScript class fields are instance properties)
    const instanceProps = Object.keys(this);
    for (const prop of instanceProps) {
      if (!prop.startsWith("_")) {
        const value = this[prop];
        if (typeof value !== "function") {
          fields.add(prop);
        }
      }
    }

    // Also check prototype chain for any fields that might be defined there
    // This handles cases where fields are defined in parent classes
    let proto = Object.getPrototypeOf(this);
    while (proto && proto !== Object.prototype && proto !== FlexDto.prototype) {
      const ownProps = Object.getOwnPropertyNames(proto);
      for (const prop of ownProps) {
        if (prop !== "constructor" && !prop.startsWith("_")) {
          const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
          // Include if it's a data property (not a getter/setter/method)
          if (descriptor && descriptor.get === undefined && descriptor.set === undefined) {
            const value = descriptor.value;
            if (typeof value !== "function") {
              fields.add(prop);
            }
          }
        }
      }
      proto = Object.getPrototypeOf(proto);
    }

    return fields;
  }

  /**
   * Check if a field name is a valid class field name
   * For fields without initial values, we allow assignment if the name follows camelCase pattern
   * and doesn't conflict with existing properties
   */
  private isValidFieldName(fieldName: string): boolean {
    // Reject private fields and methods
    if (fieldName.startsWith("_")) return false;

    // Check if it's already a field
    const classFields = this.getClassFields();
    if (classFields.has(fieldName)) return true;

    // For fields without initial values, we allow camelCase names
    // This allows assignment to declared but uninitialized fields
    // We check that it's not a method by trying to access it
    const existingValue = this[fieldName];
    if (typeof existingValue === "function") return false;

    // Allow camelCase field names (basic validation)
    // This is a heuristic - in practice, we trust that the user knows their field names
    return /^[a-z][a-zA-Z0-9]*$/.test(fieldName);
  }

  /**
   * Find matching class field for a given data key
   * Checks aliases, camelCase conversion, and exact match
   * Also handles fields without initial values by checking camelCase conversion
   */
  private findMatchingField(
    dataKey: string,
    classFields: Set<string>,
    aliases: Record<string, string[]>
  ): string | null {
    // 1. Check exact match
    if (classFields.has(dataKey)) {
      return dataKey;
    }

    // 2. Convert to camelCase and check
    const camelKey = toCamelCase(dataKey);
    if (classFields.has(camelKey)) {
      return camelKey;
    }

    // 3. Check aliases
    for (const [fieldKey, fieldAliases] of Object.entries(aliases)) {
      if (
        classFields.has(fieldKey) &&
        (fieldAliases.includes(dataKey) || fieldAliases.includes(camelKey))
      ) {
        return fieldKey;
      }
    }

    // 4. Check if any alias matches the dataKey
    for (const fieldKey of classFields) {
      const fieldAliases = aliases[fieldKey];
      if (fieldAliases && (fieldAliases.includes(dataKey) || fieldAliases.includes(camelKey))) {
        return fieldKey;
      }
    }

    // 5. For fields without initial values, return camelCase key if it's valid
    // This allows assignment to declared but uninitialized fields
    if (camelKey && camelKey !== dataKey && !camelKey.startsWith("_")) {
      const existingValue = this[camelKey];
      // If it's not a function (method), it's likely a valid field
      if (typeof existingValue !== "function") {
        return camelKey;
      }
    }

    return null;
  }

  /**
   * Initialize fields from data object
   * Call this in your constructor after super()
   * Only assigns values to fields declared in the class
   *
   * @param data - Data object (can be the same class type or any object)
   * @param options - Optional configuration for transforms, aliases, and strictMode
   */
  protected init<T = this>(data: T, options?: FlexDtoOptions<T>): void {
    if (!data || typeof data !== "object") return;

    // Merge options
    this._opts = (options as InternalOptions) || {};

    const decoratorAliases = getAliases(this);
    const decoratorTransforms = getTransforms(this);
    const aliases = { ...decoratorAliases, ...this._opts.aliases };
    const transforms = { ...decoratorTransforms, ...this._opts.transforms };

    // Get all class field names
    const classFields = this.getClassFields();

    // Process each key in the input data
    const dataObj = data as Record<string, unknown>;
    for (const dataKey in dataObj) {
      if (!Object.prototype.hasOwnProperty.call(dataObj, dataKey)) continue;
      if (dataKey.startsWith("_")) continue;

      const value = dataObj[dataKey];
      if (value === undefined) continue;

      // Always convert snake_case to camelCase first
      const camelKey = toCamelCase(dataKey);

      // Find matching class field
      let targetKey = this.findMatchingField(dataKey, classFields, aliases);

      // If no match found, use camelCase conversion (for fields without initial values)
      // This is important because fields without initial values won't be in classFields
      if (!targetKey && camelKey && camelKey !== dataKey) {
        // Check that it's not a private field or method
        if (!camelKey.startsWith("_")) {
          const existingValue = this[camelKey];
          // Allow if it's not a function (method)
          // This handles fields without initial values
          if (typeof existingValue !== "function") {
            targetKey = camelKey;
          }
        }
      }

      // Never assign snake_case keys directly - always convert to camelCase
      // This prevents snake_case properties from being added to the instance
      // Allow assignment if targetKey is camelCase (either from conversion or already camelCase)
      const shouldAssign =
        targetKey &&
        !targetKey.startsWith("_") &&
        (targetKey === camelKey || !dataKey.includes("_"));

      if (shouldAssign && targetKey) {
        // Get expected type from current value (if field already has a value)
        const currentValue = this[targetKey];
        const expectedType = currentValue !== undefined ? typeof currentValue : undefined;

        // Apply transform if exists
        const transform = transforms[targetKey];
        let finalValue: unknown = value;

        const strictMode = this._opts.strictMode ?? this._strictMode;

        if (transform) {
          try {
            finalValue = transform(value);
          } catch (error) {
            if (strictMode) {
              const className = this.constructor.name;
              const isDev = isDevelopmentMode();
              if (isDev) {
                console.warn(
                  `[flex-dto] Transform failed in ${className}.${targetKey}: ${
                    error instanceof Error ? error.message : String(error)
                  }. Using original value.`
                );
              }
            }
            finalValue = value;
          }
        } else if (expectedType && strictMode) {
          // Validate type if no transform
          this.validateType(targetKey, value, expectedType);
        }

        // Assign to class field using property access
        this[targetKey] = finalValue;
      }
    }
  }

  /**
   * Convert to plain object
   * @param useSnakeCase - Output keys in snake_case format
   */
  toPlain(useSnakeCase = false): object {
    const result: Record<string, unknown> = {};
    // Get class fields only (not dynamic properties)
    const classFields = this.getClassFields();

    for (const key of classFields) {
      const value = this[key];
      // Skip functions and private fields
      if (typeof value === "function" || key.startsWith("_")) continue;

      const outputKey = useSnakeCase ? toSnakeCase(key) : key;

      // Recursively convert nested FlexDto instances
      if (value instanceof FlexDto) {
        result[outputKey] = value.toPlain(useSnakeCase);
      } else if (Array.isArray(value)) {
        // Convert array elements if they are FlexDto instances
        result[outputKey] = value.map((item) =>
          item instanceof FlexDto ? item.toPlain(useSnakeCase) : item
        );
      } else {
        result[outputKey] = value;
      }
    }

    return result;
  }

  /**
   * Convert to JSON (camelCase keys)
   */
  toJSON(): object {
    return this.toPlain(false);
  }
}
