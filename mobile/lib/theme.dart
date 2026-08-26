import 'package:flutter/material.dart';

const kBrand = Color(0xFF21346E);
const kBrand700 = Color(0xFF1a2a5a);
const kBrand100 = Color(0xFFdce3f5);
const kSuccess = Color(0xFF16a34a);
const kWarning = Color(0xFFd97706);
const kDanger = Color(0xFFdc2626);

ThemeData appTheme() => ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: kBrand, primary: kBrand),
      appBarTheme: const AppBarTheme(
        backgroundColor: kBrand,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: kBrand,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      cardTheme: CardTheme(
        elevation: 1,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      ),
    );

Color statusColor(String? status) {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'passed':
    case 'approved':
    case 'active':
      return kSuccess;
    case 'in_progress':
    case 'pending':
      return kWarning;
    case 'failed':
    case 'rejected':
    case 'overdue':
      return kDanger;
    default:
      return Colors.grey;
  }
}

Widget statusBadge(String? status) {
  final color = statusColor(status);
  final label = (status ?? 'unknown').replaceAll('_', ' ');
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: color.withOpacity(0.12),
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: color.withOpacity(0.3)),
    ),
    child: Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
  );
}
