# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Макс
"""Tensor Lab symbolic kernel (SymPy). Works on CPython and in Pyodide."""
from .export import analyze, analyze_strings
from .metric import Metric, MetricError
from .parse import parse_metric
from .presets import PRESETS
from .simplify import equal, is_zero, simp

__all__ = ["Metric", "MetricError", "analyze", "analyze_strings", "parse_metric",
           "PRESETS", "simp", "is_zero", "equal"]
