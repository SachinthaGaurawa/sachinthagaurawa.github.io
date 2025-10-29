<?php
// -----------------------------
// Production-ready Download Script
// -----------------------------

// Map file IDs to actual files
$files = [
    'cv' => __DIR__ . '/docs/Sachintha_Gaurawa_CV.pdf',
    'research1' => __DIR__ . '/docs/AI_Driven_Disaster_Prediction_Drone_Swarm.pdf',
    'research2' => __DIR__ . '/files/Research_02.pdf'
];

// 1️⃣ Validate file ID
$fileId = $_GET['file'] ?? '';
if (!array_key_exists($fileId, $files)) {
    http_response_code(404);
    echo "File not found";
    exit;
}

$filePath = $files[$fileId];

// 2️⃣ Security: ensure the file exists and is a file
if (!is_file($filePath)) {
    http_response_code(404);
    echo "File not found";
    exit;
}

$fileName = basename($filePath);

// 3️⃣ Set safe headers for download
header('Content-Description: File Transfer');
header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="' . $fileName . '"');
header('Content-Transfer-Encoding: binary');
header('Expires: 0');
header('Cache-Control: must-revalidate');
header('Pragma: public');
header('Content-Length: ' . filesize($filePath));

// 4️⃣ Clear output buffer for large files
while (ob_get_level()) {
    ob_end_clean();
}

// 5️⃣ Efficiently stream the file (avoid loading entire file into memory)
$chunkSize = 8 * 1024 * 1024; // 8 MB per chunk
$handle = fopen($filePath, 'rb');
if ($handle === false) {
    http_response_code(500);
    echo "Failed to open file";
    exit;
}

set_time_limit(0); // prevent script timeout for large files

while (!feof($handle)) {
    $buffer = fread($handle, $chunkSize);
    echo $buffer;
    flush(); // send to client
}

fclose($handle);
exit;
?>
