import {
  Value as ValueSyntax,
  GetNamedParameter as AttrSyntax,
  Concat as ConcatSyntax,
  Get as GetSyntax,
  Helper as HelperSyntax,
  Unknown as UnknownSyntax
} from './core';

import Syntax from '../syntax';
import {
  Expressions as SerializedExpressions,
  Expression as SerializedExpression
} from 'glimmer-compiler';

const {
  isAttr,
  isConcat,
  isGet,
  isHelper,
  isUnknown,
  isValue
} = SerializedExpressions;

export default function(sexp: SerializedExpression): Syntax {
  if (isValue(sexp)) return ValueSyntax.fromSpec(sexp);
  if (isAttr(sexp)) return AttrSyntax.fromSpec(sexp);
  if (isConcat(sexp)) return ConcatSyntax.fromSpec(sexp);
  if (isGet(sexp)) return GetSyntax.fromSpec(sexp);
  if (isHelper(sexp)) return HelperSyntax.fromSpec(sexp);
  if (isUnknown(sexp)) return UnknownSyntax.fromSpec(sexp);
};