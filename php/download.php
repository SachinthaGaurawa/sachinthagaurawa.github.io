<?php
// Allowed files mapping
$files = [
    'cv' => __DIR__ . '/docs/Sachintha_Gaurawa_CV.pdf',
    'research1' => __DIR__ . '/docs/AI_Enhanced_Predictive_Safety_Framework.pdf',
    'research2' => __DIR__ . '/docs/AI_Driven_Disaster_Prediction_Drone_Swarm.pdf'
];

// Get requested file ID
$fileId = $_GET['file'] ?? '';
if (!isset($files[$fileId])) {
    http_response_code(404);
    echo "❌ File not found";
    exit;
}

$filePath = $files[$fileId];

// Security: file must exist
if (!is_file($filePath)) {
    http_response_code(404);
    echo "❌ File not found";
    exit;
}

$fileName = basename($filePath);

// 1️⃣ Clear any previous output
while (ob_get_level()) {
    ob_end_clean();
}

// 2️⃣ Set headers to force download
header('Content-Description: File Transfer');
header('Content-Type: application/pdf'); // correct MIME type for PDF
header('Content-Disposition: attachment; filename="' . $fileName . '"');
header('Content-Transfer-Encoding: binary');
header('Expires: 0');
header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
header('Pragma: public');
header('Content-Length: ' . filesize($filePath));

// 3️⃣ Read file and send to output
readfile($filePath);
exit;
