"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/@solana+programs@3.0.3_fastestsmallesttextencoderdecoder@1.0.22_typescript@5.9.3";
exports.ids = ["vendor-chunks/@solana+programs@3.0.3_fastestsmallesttextencoderdecoder@1.0.22_typescript@5.9.3"];
exports.modules = {

/***/ "(ssr)/./node_modules/.pnpm/@solana+programs@3.0.3_fastestsmallesttextencoderdecoder@1.0.22_typescript@5.9.3/node_modules/@solana/programs/dist/index.node.mjs":
/*!***************************************************************************************************************************************************************!*\
  !*** ./node_modules/.pnpm/@solana+programs@3.0.3_fastestsmallesttextencoderdecoder@1.0.22_typescript@5.9.3/node_modules/@solana/programs/dist/index.node.mjs ***!
  \***************************************************************************************************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   isProgramError: () => (/* binding */ isProgramError)\n/* harmony export */ });\n/* harmony import */ var _solana_errors__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @solana/errors */ \"(ssr)/./node_modules/.pnpm/@solana+errors@3.0.3_typescript@5.9.3/node_modules/@solana/errors/dist/index.node.mjs\");\n\n\n// src/program-error.ts\nfunction isProgramError(error, transactionMessage, programAddress, code) {\n  if (!(0,_solana_errors__WEBPACK_IMPORTED_MODULE_0__.isSolanaError)(error, _solana_errors__WEBPACK_IMPORTED_MODULE_0__.SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM)) {\n    return false;\n  }\n  const instructionProgramAddress = transactionMessage.instructions[error.context.index]?.programAddress;\n  if (!instructionProgramAddress || instructionProgramAddress !== programAddress) {\n    return false;\n  }\n  return typeof code === \"undefined\" || error.context.code === code;\n}\n\n\n//# sourceMappingURL=index.node.mjs.map\n//# sourceMappingURL=index.node.mjs.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvLnBucG0vQHNvbGFuYStwcm9ncmFtc0AzLjAuM19mYXN0ZXN0c21hbGxlc3R0ZXh0ZW5jb2RlcmRlY29kZXJAMS4wLjIyX3R5cGVzY3JpcHRANS45LjMvbm9kZV9tb2R1bGVzL0Bzb2xhbmEvcHJvZ3JhbXMvZGlzdC9pbmRleC5ub2RlLm1qcyIsIm1hcHBpbmdzIjoiOzs7OztBQUF3Rjs7QUFFeEY7QUFDQTtBQUNBLE9BQU8sNkRBQWEsUUFBUSxtRkFBdUM7QUFDbkU7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFMEI7QUFDMUI7QUFDQSIsInNvdXJjZXMiOlsid2VicGFjazovL3BhbG0tYnVkZ2V0Ly4vbm9kZV9tb2R1bGVzLy5wbnBtL0Bzb2xhbmErcHJvZ3JhbXNAMy4wLjNfZmFzdGVzdHNtYWxsZXN0dGV4dGVuY29kZXJkZWNvZGVyQDEuMC4yMl90eXBlc2NyaXB0QDUuOS4zL25vZGVfbW9kdWxlcy9Ac29sYW5hL3Byb2dyYW1zL2Rpc3QvaW5kZXgubm9kZS5tanM/ZmIzYiJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBpc1NvbGFuYUVycm9yLCBTT0xBTkFfRVJST1JfX0lOU1RSVUNUSU9OX0VSUk9SX19DVVNUT00gfSBmcm9tICdAc29sYW5hL2Vycm9ycyc7XG5cbi8vIHNyYy9wcm9ncmFtLWVycm9yLnRzXG5mdW5jdGlvbiBpc1Byb2dyYW1FcnJvcihlcnJvciwgdHJhbnNhY3Rpb25NZXNzYWdlLCBwcm9ncmFtQWRkcmVzcywgY29kZSkge1xuICBpZiAoIWlzU29sYW5hRXJyb3IoZXJyb3IsIFNPTEFOQV9FUlJPUl9fSU5TVFJVQ1RJT05fRVJST1JfX0NVU1RPTSkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY29uc3QgaW5zdHJ1Y3Rpb25Qcm9ncmFtQWRkcmVzcyA9IHRyYW5zYWN0aW9uTWVzc2FnZS5pbnN0cnVjdGlvbnNbZXJyb3IuY29udGV4dC5pbmRleF0/LnByb2dyYW1BZGRyZXNzO1xuICBpZiAoIWluc3RydWN0aW9uUHJvZ3JhbUFkZHJlc3MgfHwgaW5zdHJ1Y3Rpb25Qcm9ncmFtQWRkcmVzcyAhPT0gcHJvZ3JhbUFkZHJlc3MpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHR5cGVvZiBjb2RlID09PSBcInVuZGVmaW5lZFwiIHx8IGVycm9yLmNvbnRleHQuY29kZSA9PT0gY29kZTtcbn1cblxuZXhwb3J0IHsgaXNQcm9ncmFtRXJyb3IgfTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4Lm5vZGUubWpzLm1hcFxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9aW5kZXgubm9kZS5tanMubWFwIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/.pnpm/@solana+programs@3.0.3_fastestsmallesttextencoderdecoder@1.0.22_typescript@5.9.3/node_modules/@solana/programs/dist/index.node.mjs\n");

/***/ })

};
;