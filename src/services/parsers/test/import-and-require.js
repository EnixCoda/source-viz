import "b0.js";
import b1 from "b1.js";
import { b2 } from "b2.js";

import("b3.js");
import(`b4.js`);
import(`b5.js${1}`);

import("xb6.js" + "");
import(`xb7.js` + "");
import(`xb8.js${1}` + "");

require("b9.js");
require(`b10.js`);
require(`xb11.js${1}`);

require("xb12.js" + "");
require(`xb13.js` + "");

function x() {
  require("b14.js");
  import("b15.js");
}
