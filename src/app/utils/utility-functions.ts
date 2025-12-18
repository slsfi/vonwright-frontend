/**
 * If the given value exists in the array, it is removed from the array.
 * Otherwise the value is added to the array. The array is modified in place.
 * @param array to add or remove value to/from.
 * @param value to add to or remove from array.
 */
export function addOrRemoveValueInArray(array: any[], value: any) {
  let index = array.indexOf(value);
  if (index > -1) {
    array.splice(index, 1);
  } else {
    array.push(value);
  }
}


/**
 * Returns a new array where the given value is added or removed.
 * If the value exists, it is removed. If not, it is added.
 * @param array The original array.
 * @param value The value to toggle.
 * @returns A new array with the value added or removed.
 */
export function addOrRemoveValueInNewArray<T>(array: T[], value: T): T[] {
  return array.includes(value)
        ? array.filter(v => v !== value)
        : [...array, value];
}


/**
 * Reorders the given array by moving the item at position 'fromIndex'
 * to the position 'toIndex'. Returns the reordered array.
 */
export function moveArrayItem(array: any[], fromIndex: number, toIndex: number) {
  const reorderedArray = array;
  if (
    fromIndex > -1 &&
    toIndex > -1 &&
    fromIndex < array.length &&
    toIndex < array.length &&
    fromIndex !== toIndex
  ) {
    reorderedArray.splice(toIndex, 0, reorderedArray.splice(fromIndex, 1)[0]);
  }
  return reorderedArray;
}


/**
 * Given an array with names of people, this function return a string
 * where the names have been concatenated. The string given in 'separator'
 * is used as a separator between all of the names except between the
 * second to last and last, which are separated by an ampersand (&).
 * @param names An array of strings with the names that are to be concatenated.
 * @returns A string with the names concatenated.
 */
export function concatenateNames(names: string[], separator = ';') {
  let names_str = '';
  for (let i = 0; i < names.length; i++) {
    names_str = names_str + names[i];
    if (names.length > 2) {
      if (i < names.length - 2) {
        names_str = names_str + separator + ' ';
      } else if (i < names.length - 1) {
        names_str = names_str + ' \u0026 ';
      }
    } else if (names.length === 2 && i < 1) {
      names_str = names_str + ' \u0026 ';
    }
  }
  return names_str;
}


/**
 * Converts the given named entity type to the form required by the
 * backend API: 'person' is converted to 'subject', 'place' to 'location'
 * and 'keyword' to 'tag'.
 * @param type string
 * @returns string
 */
export function convertNamedEntityTypeForBackend(type: string): string {
  return (type === 'person') ? 'subject'
    : (type === 'place') ? 'location'
      : (type === 'keyword') ? 'tag'
        : type;
}


/**
 * Parses the given string for encoded HTML entities and decodes them.
 * @param string to parse.
 * @returns modified string.
 */
export function decodeHtmlEntity(string: string): string {
  return string.replace(/&#(\d+);/g, function (match, dec) {
    return String.fromCharCode(dec);
  });
}


/**
 * Given an object with nested objects in the property 'branchingKey',
 * returns a flattened array of the object. If 'requiredKey' is not
 * undefined, only objects that have a non-empty 'requiredKey' property
 * are included.
 */
export function flattenObjectTree(
  data: any,
  branchingKey: string = 'children',
  requiredKey?: string
) {
  const dataWithoutChildren = (({ [branchingKey]: _, ...d }) => d)(data);
  let list: any[] = [];
  if (!requiredKey || (requiredKey && data[requiredKey])) {
    list = [dataWithoutChildren];
  }
  if (
    !data[branchingKey] && (
      !requiredKey || (requiredKey && data[requiredKey])
    )
  ) {
    return list;
  }
  if (data[branchingKey]?.length) {
    for (const child of data[branchingKey]) {
      list = list.concat(
        flattenObjectTree(child, branchingKey, requiredKey)
      );
    }
  }
  return list;
}


/**
 * Checks if the code is running in a browser by checking the existance
 * of the window object.
 * @returns boolean
 */
export function isBrowser(): boolean {
  if (typeof window !== 'undefined') {
    return true;
  } else {
    return false;
  }
}


/**
 * Returns true if the given object is empty, i.e. has no properties, else false.
 */
export function isEmptyObject(obj: any) {
  return !(() => {
    for (const i in obj) {
      return true;
    }
    return false;
  })();
}


/**
 * Check if a number is even.
 */
export function numberIsEven(value: number) {
  if (value % 2 === 0) {
    return true;
  } else {
    return false;
  }
}


/**
 * Function for sorting an array of objects alphabetically ascendingly based
 * on the given object key (field).
 */
export function sortArrayOfObjectsAlphabetically(
  arrayToSort: any,
  fieldToSortOn: string
) {
  if (Array.isArray(arrayToSort)) {
    arrayToSort.sort((a, b) => {
      const fieldA = String(a[fieldToSortOn]).toUpperCase();
      const fieldB = String(b[fieldToSortOn]).toUpperCase();
      if (fieldA < fieldB) {
        return -1;
      }
      if (fieldA > fieldB) {
        return 1;
      }
      return 0;
    });
  }
}


/**
 * Function for sorting an array of objects numerically based on the
 * given object key (field). The order can be either ascendingly
 * 'asc' or descendingly 'desc'.
 */
export function sortArrayOfObjectsNumerically(
  arrayToSort: any,
  fieldToSortOn: string,
  order: string = 'desc'
) {
  if (Array.isArray(arrayToSort)) {
    arrayToSort.sort((a, b) => {
      if (a[fieldToSortOn] && b[fieldToSortOn]) {
        if (a[fieldToSortOn] > b[fieldToSortOn]) {
          if (order === 'desc') {
            return -1;
          } else {
            return 1;
          }
        }
        if (a[fieldToSortOn] < b[fieldToSortOn]) {
          if (order === 'desc') {
            return 1;
          } else {
            return -1;
          }
        }
      }
      return 0;
    });
  }
}


/**
 * Check if a file is found behind the given url. Returns 1 if file found,
 * otherwise 0.
 */
export async function urlExists(url: string) {
  try {
    const response = await fetch(
      url, { method: 'HEAD', cache: 'no-store' }
    );
    if (response.ok && response.status !== 404) {
      return 1;
    } else {
      return 0;
    }
  } catch (error) {
    console.log('Could not fetch ', url);
    console.error(`${error}`);
    return 0;
  }
}


/**
 * Check if a front matter page should be enabled for a collection,
 * or if a view type should be enabled for the text pages in a
 * collection.
 * @param pageType one of 'cover', 'title', 'foreword', 'introduction', 'text'
 * @param collectionId string
 * @param config object
 * @param viewType string | undefined: only applicable if pageType = 'text',
 * one of 'readingtext', 'comments', 'facsimiles', 'manuscripts', 'variants',
 * 'illustrations', 'legend', 'metadata'
 * @returns boolean
 */
export function enableFrontMatterPageOrTextViewType(
  pageType: string,
  collectionId: string,
  config: any,
  viewType?: string
) {
  const defaultEnable: boolean = (pageType === 'text')
    ? config.page?.text?.viewTypes?.[viewType || ''] ?? false
    : config.collections?.frontMatterPages?.[pageType] ?? false;

  if (!defaultEnable) {
    return false;
  }

  const collection = Number(collectionId);

  const disabledCollections: number[] = (pageType === 'text')
    ? config.page?.text?.viewTypeDisabledCollections?.[viewType || ''] ?? []
    : config.collections?.frontMatterPageDisabled?.[pageType] ?? [];

  return !disabledCollections.includes(collection);
}


/**
 * Splits a filename into its base name and extension.
 *
 * This function finds the last dot (`.`) in the filename and splits it
 * into two parts:
 * - The part before the last dot is considered the base name.
 * - The part after the last dot is considered the extension.
 *
 * Special cases:
 * - If the filename has no dot or starts with a dot (e.g., ".bashrc"),
 *   it is treated as having no extension.
 * - For compound extensions (e.g., "archive.tar.gz"), only the last part
 *   ("gz") is returned as the extension.
 *
 * @param filename - The full filename as a string (e.g., "document.pdf",
 *                   "archive.tar.gz", ".bashrc").
 * @returns An object with `name` (the base name) and `extension` (the file
 *          type/extension). 
 */
export function splitFilename(filename: string): { name: string; extension: string } {
  const lastDotIndex = filename.lastIndexOf(".");

  if (lastDotIndex === -1 || lastDotIndex === 0) {
    return { name: filename, extension: "" };
  }

  const name = filename.slice(0, lastDotIndex);
  const extension = filename.slice(lastDotIndex + 1);
  return { name, extension };
}


/**
 * Detects the “File not found” placeholder page content returned by the
 * content API.
 *
 * Some endpoints return a minimal HTML document whose body includes
 * `<body>File not found</body>` or is exactly `File not found` when the
 * requested resource is missing. This helper provides a  null/undefined-safe
 * check before trying to render or parse the HTML.
 *
 * Notes:
 * - Uses a simple substring check (no DOM parsing) for performance.
 * - The match is **case- and whitespace-sensitive**. If the backend’s
 *   formatting changes, consider a more tolerant check (e.g., regex).
 *
 * @param s Raw HTML returned by the API (may be `null`/`undefined`).
 * @returns `true` if `s` contains the exact `<body>File not found</body>`
 * snippet or is the exact string `File not found`; otherwise `false`.
 */
export function isFileNotFoundHtml(s: string | undefined | null): boolean {
  return !!s && (s === "File not found" || s.includes('<body>File not found</body>'));
}
