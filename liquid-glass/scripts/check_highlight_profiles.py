#!/usr/bin/env python3
"""Report the peak and continuous relative widths of sampled L5 contributions.

Input JSON maps section names to arrays of linear Y(B5)-Y(B4b), or an isolated
light contribution, in equally spaced inward-normal sampling order. A result
does not pass the visual test by itself. Shipped self-test is synthetic.
"""
import argparse
import json
import math

def measure(values, step, fraction, noise):
    if len(values) < 3 or not all(math.isfinite(x) for x in values):
        raise ValueError('need at least three finite samples per profile')
    peak = max(values)
    if peak <= 0:
        return {'peak': peak, 'width': None, 'reason': 'no positive contribution'}
    level = peak * fraction
    if level <= noise:
        return {'peak': peak, 'width': None, 'reason': 'relative level below noise'}
    i = values.index(peak)
    a = b = i
    while a > 0 and values[a - 1] >= level:
        a -= 1
    while b < len(values) - 1 and values[b + 1] >= level:
        b += 1
    if b == len(values) - 1:
        return {'peak': peak, 'width': None, 'reason': 'sample farther inward'}
    # The start of the profile is the actual glass boundary; outward cover is excluded.
    left = a if a == 0 else a - (values[a] - level) / (values[a] - values[a - 1])
    right = b + (values[b] - level) / (values[b] - values[b + 1])
    return {'peak': peak, 'width': round((right - left) * step, 6)}

def self_test():
    strong = [1, .86, .68, .5, .30, .16, .08, .02, 0]
    only_dim = [v * .20 for v in strong]
    thinner = [.20, .10, .045, .013, .005, 0, 0, 0, 0]
    profiles = {k:measure(v, 1, .5, .002) for k,v in
        {'bright':strong, 'fake_width_change':only_dim, 'actual_width_change':thinner}.items()}
    assert profiles['bright']['width'] == profiles['fake_width_change']['width']
    assert profiles['bright']['width'] > profiles['actual_width_change']['width']
    assert measure([.002, .001, 0], 1, .5, .002)['width'] is None
    assert measure([1, .9, .7], 1, .5, .002)['width'] is None
    print(json.dumps(profiles, indent=2))

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('input', nargs='?')
    p.add_argument('--step', type=float, default=1.)
    p.add_argument('--fraction', type=float, default=.5)
    p.add_argument('--noise', type=float, default=0.)
    p.add_argument('--self-test', action='store_true')
    args = p.parse_args()
    if not 0 < args.fraction < 1 or not math.isfinite(args.step) or args.step <= 0 or not math.isfinite(args.noise) or args.noise < 0:
        p.error('positive finite step, 0 < fraction < 1, finite nonnegative noise required')
    if args.self_test:
        self_test()
    elif args.input:
        with open(args.input, encoding='utf-8') as f:
            data = json.load(f)
        print(json.dumps({k:measure(v,args.step,args.fraction,args.noise) for k,v in data.items()}, ensure_ascii=False, indent=2))
    else:
        p.error('provide input JSON or --self-test')
