# Heck

Heck is a language I created for fun. There is no purpose for the language it self. I'm sure there's critical bugs. I made this for the challenge of making it. I didn't google anything about making programming languages. I think my parsing it probably really bad. I think parse time might grow exponentially with the length of the code, not really sure.

## Examples

More examples can be found [here](./examples)

### Hello World
```
return "Hello, World!";
```

#### Notes:
return can be used out side of code blocks to exit the program and print the final value.

Semicolons are may not always cause errors when excluded, but in many places they will, so use them.

### Variables
```
x = 1
_ = 2
another2 = 3
```

#### Notes
Variables names cannot start with a number.

### Functions
```
printAlias = fn! arg: print arg;
printAlias "I called a function!";
```
```
add = fn [a, b]: a + b;
return add [1, 2]
```

#### Notes:
Functions are composed of a single expression as the body.

Functions are sometimes lazy (because its kinda broken oof) but if you want a function to always be run immediately when called (maybe for io) use the `!` as seen in the first example.

Functions only accept a single argument, so pass an array and destructure values.

Functions create their own enclosed scope.

Functions have a value in scope called `recurse` that refers to the function being run. This can be useful if you want to use recursion inside a function that is not saved to a variable, but that often leads to uglier code so be careful with that.

### Code Blocks
```
result = {
  a = 1;
  a = a + 1;
  a = a + 1;
  return a;
};
return result + 1;
```
```
add = fn [a, b]: {
  return a + b;
};
return add [1, 2];
```

#### Notes:
Code blocks outside are treated as a single expression. This means they can be placed anywhere that any other value would be placed (Well actually I think theres a few places it might require `()` around it to parse correctly).

A code block can be placed as the body of a function to create longer functions.

Code blocks create their own enclosed scope.

### Built in functions

```
return sum [1,2,3];
```
Take the sum of an array. The `+` operator actually calls this internally. All infix operators also have a named version in scope. Some are limited to 2 parameters like (`divide` and `mod`), but others work for any number of elements like `product`, `any` (used for the or operation, `|`) and `every` (used for the and operator, `&`).
```
return filter [range [0, 20], fn n: n % 2 == 0];
```
`range` returns [begin, end).
`filter` takes an array and a predicate that accepts a value from the array and returns boolean (truthy probably works as well, I'm not sure).
```
addOne = fn a: a + 1;
div2 = fn a: a + 1;
addTwoDiv2 = compose [addOne, addOne, div2];
return addTwoDiv2 6;
```
This example returns 4 (not 5).

More built in functions can be found [./builtins.ts](./builtins.ts).

## Running

`deno run --allow-read mod.ts ./file.heck`
