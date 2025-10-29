<?php
// -----------------------------
// Safe and reliable PDF download
// -----------------------------

// Map file IDs to actual files (keys match JS map)
$files = [
    'research1' => __DIR__ . '/docs/AI_Enhanced_Predictive_Safety_Framework.pdf',
    'research2' => __DIR__ . '/docs/AI_Driven_Disaster_Prediction_Drone_Swarm.pdf'
];

// 1️⃣ Get requested file ID
$fileId = $_GET['file'] ?? '';

// 2️⃣ Validate
if (!isset($files[$fileId])) {
    http_response_code(404);
    echo "❌ File not found";
    exit;
}

$filePath = $files[$fileId];

// 3️⃣ Check existence
if (!is_file($filePath)) {
    http_response_code(404);
    echo "❌ File not found";
    exit;
}

$fileName = basename($filePath);

// 4️⃣ Force download headers
header('Content-Description: File Transfer');
header('Content-Type: application/pdf'); // PDF files
header('Content-Disposition: attachment; filename="' . $fileName . '"');
header('Content-Transfer-Encoding: binary');
header('Expires: 0');
header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
header('Pragma: public');
header('Content-Length: ' . filesize($filePath));

// 5️⃣ Clean output buffer
if (ob_get_level()) {
    ob_end_clean();
}

// 6️⃣ Stream file in chunks (efficient for large PDFs)
$chunkSize = 8 * 1024 * 1024; // 8MB
$handle = fopen($filePath, 'rb');
if ($handle === false) {
    http_response_code(500);
    echo "❌ Failed to open file";
    exit;
}

set_time_limit(0);

while (!feof($handle)) {
    echo fread($handle, $chunkSize);
    flush();
}

fclose($handle);
exit;
