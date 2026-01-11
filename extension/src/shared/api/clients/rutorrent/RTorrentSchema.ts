import { z } from 'zod';

/**
 * rTorrent XML-RPC Response (Parsed via tXml/Internal)
 * 
 * After parsing XML, we expect a specific structure.
 * For `d.multicall2`, it returns an array of arrays (tuples).
 * 
 * Column Order MUST match the request in `RTorrentAdapter.ts`:
 * 0: hash (string)
 * 1: name (string)
 * 2: size (string/i8)
 * 3: bytes_done (string/i8)
 * 4: up_rate (number/i4)
 * 5: down_rate (number/i4)
 * 6: complete (number/i4 -> bool)
 * 7: state (number/i4 -> bool)
 * 8: is_active (number/i4 -> bool)
 * 9: label (string)
 * 10: ratio (number/i4)
 * 11: hashing (number/i4 -> bool)
 * 12: save_path (string)
 * 13: up_total (string/i8)
 * 14: message (string)
 */
export const RTorrentMulticallTuple = z.tuple([
    z.string(), // hash
    z.string(), // name
    z.union([z.string(), z.number()]), // size
    z.union([z.string(), z.number()]), // bytes_done
    z.number(), // up_rate
    z.number(), // down_rate
    z.number(), // complete
    z.number(), // state
    z.number(), // is_active
    z.string(), // label
    z.number(), // ratio
    z.number(), // hashing
    z.string(), // save_path
    z.union([z.string(), z.number()]), // up_total
    z.string().optional() // message
]);

export const RTorrentResponseSchema = z.array(RTorrentMulticallTuple);

export type RTorrentTuple = z.infer<typeof RTorrentMulticallTuple>;
