import { v4 as uuid } from 'uuid';
import { tick } from './runtime';

tick([]);                                  // genesis tick

tick([['0x01', { id: uuid(), from: '0x01', text: 'hello world' }]]);
/* output ➜
Frame #1: [ 'hello world' ]
*/
